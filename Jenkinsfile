pipeline {
  agent any

  options {
    timestamps()
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
      defaultValue: 'pios.local',
      description: 'Remote host name or IP for deployment'
    )
    string(
      name: 'REMOTE_APP_NAME',
      defaultValue: 'dev-tools',
      description: 'Container name to use on the remote host'
    )
    string(
      name: 'REMOTE_PORT_MAPPING',
      defaultValue: '5000:3000',
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
      description: 'Additional docker run flags (space-delimited)'
    )
    string(
      name: 'SSH_CREDENTIALS_ID',
      defaultValue: 'remote-ssh-key',
      description: 'Jenkins credential ID for the SSH private key used to authenticate to the remote host'
    )
  }

  environment {
    DOCKER_BUILDKIT = '1'
    BUILDX_INSTANCE = 'multiarch'
    IMAGE_NAME      = 'dev-tools'
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

    stage('Setup Buildx') {
      steps {
        sh '''
          docker buildx create --name "${BUILDX_INSTANCE}" --bootstrap --use || docker buildx use "${BUILDX_INSTANCE}"
          docker buildx inspect --bootstrap
        '''
      }
    }

    stage('Build Image') {
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

    stage('Deploy Remote') {
      when {
        expression { params.DEPLOY_REMOTE }
      }
      steps {
        script {
          def imageTag = "${env.IMAGE_NAME}:${env.BUILD_NUMBER}"
          def remoteHost = params.REMOTE_HOST?.trim()
          def remoteApp = params.REMOTE_APP_NAME?.trim()
          def remotePortMapping = params.REMOTE_PORT_MAPPING?.trim()
          def envArgsRaw = params.REMOTE_ENV_VARS ?: ''
          def envArgs = envArgsRaw.replace('${SITE_URL}', params.SITE_URL ?: '')
          def runArgs = params.REMOTE_RUN_ARGS ?: ''
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

          def envArgsTrimmed = envArgs?.trim()
          def runArgsTrimmed = runArgs?.trim()

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
          if (runArgsTrimmed) {
            runCommandParts << runArgsTrimmed
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

              echo "Registering remote host key"
              mkdir -p ~/.ssh && chmod 700 ~/.ssh
              ssh-keyscan -H "${remoteHost}" >> ~/.ssh/known_hosts

              echo "Saving and transferring image to ${remoteHost}"
              docker save "\$IMAGE_TAG" | gzip | ssh -i "\$DEPLOY_KEY" "\$SSH_TARGET" 'gunzip | docker load'

              echo "Restarting container ${remoteApp} on ${remoteHost}"
              ssh -i "\$DEPLOY_KEY" "\$SSH_TARGET" 'bash -s' <<"REMOTE_SCRIPT"
set -euo pipefail
docker stop ${remoteApp} || true
docker rm ${remoteApp} || true
${remoteRunCommand}
REMOTE_SCRIPT
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
