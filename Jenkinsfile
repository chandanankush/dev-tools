pipeline {
  agent any

  options {
    timestamps()
    // A normal run takes ~5 minutes; this only exists so a stalled step (e.g. a hung image
    // pull) fails the build instead of occupying the executor indefinitely.
    timeout(time: 30, unit: 'MINUTES')
  }

  parameters {
    string(
      name: 'SITE_URL',
      defaultValue: 'https://mopplications.com',
      description: 'Public URL for metadata (sets NEXT_PUBLIC_SITE_URL)'
    )
    booleanParam(
      name: 'DEPLOY_REMOTE',
      defaultValue: true,
      description: 'Transfer and run the built image on a remote Docker host'
    )
    string(
      name: 'REMOTE_HOST',
      defaultValue: 'pipubserver.local',
      description: 'Remote host name or IP for deployment'
    )
    string(
      name: 'REMOTE_APP_NAME',
      defaultValue: 'dev-tools',
      description: 'Container name to use on the remote host'
    )
    string(
      name: 'REMOTE_PORT_MAPPING',
      defaultValue: '3050:3050',
      description: 'Value passed to docker run -p (host:container)'
    )
    string(
      name: 'REMOTE_ENV_VARS',
      defaultValue: '-e NEXT_PUBLIC_SITE_URL=${SITE_URL}',
      description: 'Extra environment flags for docker run (SITE_URL placeholder allowed)'
    )
    string(
      name: 'REMOTE_RUN_ARGS',
      defaultValue: '',
      description: '''Optional extra docker run flags, appended verbatim after the port, env and data-volume flags.
The pipeline always mounts the dev-tools-data volume at /app/data (it stores the visitor count),
so do not mount /app/data here.
Examples (pick what you need, space-separated):
  Resource limits:   --memory 512m --cpus 1.0
  Log rotation:      --log-opt max-size=10m --log-opt max-file=3
  Custom network:    --network my-net
  Read-only mount:   -v /host/config:/app/config:ro
  Multiple together: --memory 512m --log-opt max-size=10m --network my-net'''
    )
    string(
      name: 'SSH_CREDENTIALS_ID',
      defaultValue: 'pi-ssh-key',
      description: 'Jenkins credential ID for the SSH private key used to authenticate to the remote host'
    )
  }

  environment {
    DOCKER_BUILDKIT = '1'
    BUILDX_INSTANCE = 'multiarch'
    IMAGE_NAME      = 'dev-tools'
    DATA_VOLUME     = 'dev-tools-data'
    DATA_DIR        = '/app/data'
    PATH            = "/usr/local/bin:/opt/homebrew/bin:${env.PATH}"
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Repo Info') {
      steps {
        script {
          echo "Branch: ${env.BRANCH_NAME ?: 'unknown'}"
          echo "Commit: ${env.GIT_COMMIT ?: 'unknown'}"
          echo "Build URL: ${env.BUILD_URL ?: 'n/a'}"
        }
        sh '''
          echo "HEAD details:" && git --no-pager log -1 --pretty=format:'%H %s (%an)' && echo
          echo "Current workspace status:" && git status -sb
        '''
      }
    }

    // Runs before the (slow) build so an unreachable or unsuitable deploy target is found in seconds.
    stage('Remote Precheck') {
      when {
        expression { params.DEPLOY_REMOTE }
      }
      options {
        timeout(time: 3, unit: 'MINUTES')
      }
      steps {
        script {
          def remoteHost = params.REMOTE_HOST?.trim()
          def sshCredsId = params.SSH_CREDENTIALS_ID?.trim() ?: 'remote-ssh-key'

          if (!remoteHost) {
            error('REMOTE_HOST must be provided when DEPLOY_REMOTE is enabled')
          }

          withEnv(["PRECHECK_HOST=${remoteHost}"]) {
            withCredentials([sshUserPrivateKey(credentialsId: sshCredsId, keyFileVariable: 'DEPLOY_KEY', usernameVariable: 'DEPLOY_USER')]) {
              sh label: 'Check the deploy host is reachable and suitable', script: '''
                set -euo pipefail

                mkdir -p ~/.ssh && chmod 700 ~/.ssh
                if ! ssh-keygen -F "$PRECHECK_HOST" >/dev/null 2>&1; then
                  echo "Registering SSH host key for $PRECHECK_HOST"
                  HOST_KEYS="$(ssh-keyscan -T 10 -H "$PRECHECK_HOST" 2>/dev/null || true)"
                  if [ -z "$HOST_KEYS" ]; then
                    echo "ERROR: cannot reach $PRECHECK_HOST on SSH (port 22). Is the host on and on the network/tailnet, and is REMOTE_HOST right?" >&2
                    exit 1
                  fi
                  echo "$HOST_KEYS" >> ~/.ssh/known_hosts
                fi

                echo "Connecting to $DEPLOY_USER@$PRECHECK_HOST"
                if ! ssh -i "$DEPLOY_KEY" -o BatchMode=yes -o IdentitiesOnly=yes -o ConnectTimeout=10 \\
                    -o ServerAliveInterval=5 -o ServerAliveCountMax=3 \\
                    "$DEPLOY_USER@$PRECHECK_HOST" "bash -s -- '$DATA_VOLUME'" < ci/remote-precheck.sh; then
                  echo "ERROR: the remote precheck failed (see the output above). Nothing has been built or changed." >&2
                  exit 1
                fi
              '''
            }
          }
        }
      }
    }

    stage('Docker Readiness') {
      options {
        timeout(time: 5, unit: 'MINUTES')
      }
      steps {
        sh '''
          set -euo pipefail

          if docker info >/dev/null 2>&1; then
            echo "Docker is already running."
          else
            echo "Docker daemon not reachable — attempting to start Docker Desktop..."
            open -a Docker || true

            WAIT=0
            MAX=90
            until docker info >/dev/null 2>&1; do
              if [ "$WAIT" -ge "$MAX" ]; then
                echo "ERROR: Docker did not start within ${MAX}s. Aborting."
                exit 1
              fi
              echo "  waiting for Docker daemon... (${WAIT}s elapsed)"
              sleep 5
              WAIT=$((WAIT + 5))
            done
            echo "Docker is now running (${WAIT}s waited)."
          fi

          docker version --format "Client: {{.Client.Version}}  Server: {{.Server.Version}}"
        '''
      }
    }

    stage('Setup Buildx') {
      steps {
        // A hung image pull never fails, so the retry loop below cannot help; the timeout turns a
        // hang into a failure and `retry` starts a clean attempt.
        retry(2) {
          timeout(time: 5, unit: 'MINUTES') {
            sh '''
              set -uo pipefail

              # A cold-started Docker Desktop answers `docker info` before its
              # storage subsystem is fully initialised, so buildx's buildkit
              # container fails to boot with "RWLayer ... is unexpectedly nil".
              # Tear down any stale builder left by a previous run and retry the
              # bootstrap with backoff until the daemon has settled.
              bootstrap_buildx() {
                docker buildx rm "${BUILDX_INSTANCE}" 2>/dev/null || true
                docker rm -f "buildx_buildkit_${BUILDX_INSTANCE}0" 2>/dev/null || true
                docker buildx create --name "${BUILDX_INSTANCE}" --bootstrap --use \\
                  && docker buildx inspect --bootstrap
              }

              ATTEMPT=1
              MAX_ATTEMPTS=6
              until bootstrap_buildx; do
                if [ "$ATTEMPT" -ge "$MAX_ATTEMPTS" ]; then
                  echo "ERROR: buildx failed to bootstrap after ${MAX_ATTEMPTS} attempts."
                  exit 1
                fi
                echo "buildx bootstrap failed (attempt ${ATTEMPT}/${MAX_ATTEMPTS}) — Docker likely still warming up; retrying in 10s..."
                ATTEMPT=$((ATTEMPT + 1))
                sleep 10
              done
            '''
          }
        }
      }
    }

    stage('Build Image') {
      options {
        timeout(time: 20, unit: 'MINUTES')
      }
      steps {
        sh '''
          docker buildx build \
            --platform linux/arm64/v8 \
            --build-arg NEXT_PUBLIC_SITE_URL=${SITE_URL} \
            --tag ${IMAGE_NAME}:${BUILD_NUMBER} \
            --load \
            .
        '''
      }
    }

    stage('Prune Old Images') {
      steps {
        sh '''
          set -euo pipefail
          echo "Pruning old ${IMAGE_NAME} images on build agent (keeping :${BUILD_NUMBER})"
          OLD_IMAGES=$(docker images "${IMAGE_NAME}" --format '{{.ID}} {{.Repository}}:{{.Tag}}' | grep -v ":${BUILD_NUMBER}$" | awk '{print $1}' | sort -u || true)
          if [ -n "$OLD_IMAGES" ]; then
            echo "$OLD_IMAGES" | xargs docker rmi -f || true
          else
            echo "No old images to remove."
          fi
          docker images "${IMAGE_NAME}"
        '''
      }
    }

    stage('Deploy Remote') {
      when {
        expression { params.DEPLOY_REMOTE }
      }
      options {
        timeout(time: 15, unit: 'MINUTES')
      }
      steps {
        script {
          def imageTag = "${env.IMAGE_NAME}:${env.BUILD_NUMBER}"
          def remoteHost = params.REMOTE_HOST?.trim()
          def remoteApp = params.REMOTE_APP_NAME?.trim()
          def remotePortMapping = params.REMOTE_PORT_MAPPING?.trim()
          def envArgsRaw = params.REMOTE_ENV_VARS ?: ''
          def envArgs = envArgsRaw.replace('${SITE_URL}', params.SITE_URL ?: '')
          // The data volume is part of the app's design (it holds the visitor count), so the pipeline
          // always mounts it. Older saved job forms may still carry it in REMOTE_RUN_ARGS: drop that
          // copy so Docker does not see a duplicate mount point.
          def dataMount = "-v ${env.DATA_VOLUME}:${env.DATA_DIR}"
          def extraRunArgs = (params.REMOTE_RUN_ARGS ?: '').replace(dataMount, '').trim()
          def sshCredsId = params.SSH_CREDENTIALS_ID?.trim() ?: 'remote-ssh-key'

          if (!remoteHost) {
            error('REMOTE_HOST must be provided when DEPLOY_REMOTE is enabled')
          }
          if (!remoteApp) {
            error('REMOTE_APP_NAME must be provided when DEPLOY_REMOTE is enabled')
          }
          if (!remotePortMapping) {
            error('REMOTE_PORT_MAPPING must be provided when DEPLOY_REMOTE is enabled')
          }

          if (extraRunArgs.contains(env.DATA_DIR)) {
            error("REMOTE_RUN_ARGS must not mount ${env.DATA_DIR}: the pipeline always mounts the ${env.DATA_VOLUME} volume there")
          }

          def envArgsTrimmed = envArgs?.trim()

          def runCommandParts = [
            'docker run',
            '-d',
            "--name ${remoteApp}",
            '--restart unless-stopped',
            "-p ${remotePortMapping}"
          ]

          if (envArgsTrimmed) {
            runCommandParts << envArgsTrimmed
          }
          runCommandParts << dataMount
          if (extraRunArgs) {
            runCommandParts << extraRunArgs
          }
          runCommandParts << imageTag

          def remoteRunCommand = runCommandParts.join(' ')

          withCredentials([sshUserPrivateKey(credentialsId: sshCredsId, keyFileVariable: 'DEPLOY_KEY', usernameVariable: 'DEPLOY_USER')]) {
            sh label: 'Deploy image to remote host', script: """
              set -euo pipefail
              export PATH="/usr/local/bin:/opt/homebrew/bin:\$PATH"

              IMAGE_TAG="${imageTag}"
              SSH_TARGET="\${DEPLOY_USER}@${remoteHost}"

              echo "Verifying local image: \$IMAGE_TAG"
              docker image inspect "\$IMAGE_TAG" >/dev/null 2>&1 || { echo "Image not found locally (\$IMAGE_TAG)"; exit 1; }

              mkdir -p ~/.ssh && chmod 700 ~/.ssh
              ssh-keygen -F "${remoteHost}" >/dev/null 2>&1 || ssh-keyscan -T 10 -H "${remoteHost}" >> ~/.ssh/known_hosts

              echo "Saving and transferring image to ${remoteHost}"
              docker save "\$IMAGE_TAG" | gzip | ssh -i "\$DEPLOY_KEY" "\$SSH_TARGET" 'gunzip | docker load'

              echo "Restarting container ${remoteApp} on ${remoteHost}"
              ssh -i "\$DEPLOY_KEY" "\$SSH_TARGET" 'bash -s' <<"REMOTE_SCRIPT"
set -euo pipefail
docker stop ${remoteApp} || true
docker rm ${remoteApp} || true
${remoteRunCommand}
REMOTE_SCRIPT

              echo "Verifying the deployment on ${remoteHost}"
              ssh -i "\$DEPLOY_KEY" "\$SSH_TARGET" "bash -s -- '${remoteApp}' '${env.DATA_VOLUME}' '${env.DATA_DIR}'" < ci/verify-deploy.sh

              echo "Pruning old ${env.IMAGE_NAME} images on ${remoteHost} (keeping :${env.BUILD_NUMBER})"
              ssh -i "\$DEPLOY_KEY" "\$SSH_TARGET" 'bash -s' <<"PRUNE_SCRIPT"
set -euo pipefail
OLD_IMAGES=\$(docker images ${env.IMAGE_NAME} --format '{{.ID}} {{.Repository}}:{{.Tag}}' | grep -v ":${env.BUILD_NUMBER}\$" | awk '{print \$1}' | sort -u || true)
if [ -n "\$OLD_IMAGES" ]; then
  echo "\$OLD_IMAGES" | xargs docker rmi -f || true
else
  echo "No old images to remove on ${remoteHost}."
fi
PRUNE_SCRIPT
            """.stripIndent()
          }
        }
      }
    }
  }

  post {
    always {
      sh 'docker buildx rm "${BUILDX_INSTANCE}" || true'
    }
  }
}
