pipeline {
  agent any

  options {
    timestamps()
  }

  parameters {
    string(
      name: 'SITE_URL',
      defaultValue: 'https://dev-tools.example.com',
      description: 'Public URL for metadata (sets NEXT_PUBLIC_SITE_URL)'
    )
    string(
      name: 'IMAGE_NAME',
      defaultValue: 'ghcr.io/your-org/dev-tools',
      description: 'Target image name (registry/namespace/repository)'
    )
    booleanParam(
      name: 'PUSH_IMAGE',
      defaultValue: false,
      description: 'Push built image to the registry (requires credentials)'
    )
  }

  environment {
    DOCKER_BUILDKIT = '1'
    BUILDX_INSTANCE = 'multiarch'
    PATH = "/usr/local/bin:/opt/homebrew/bin:${env.PATH}"
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

    stage('Push Image') {
      when {
        expression { params.PUSH_IMAGE }
      }
      steps {
        withCredentials([usernamePassword(credentialsId: 'registry-creds', usernameVariable: 'REGISTRY_USERNAME', passwordVariable: 'REGISTRY_PASSWORD')]) {
          sh '''
            echo "${REGISTRY_PASSWORD}" | docker login "$(echo ${IMAGE_NAME} | cut -d/ -f1)" --username "${REGISTRY_USERNAME}" --password-stdin
            docker buildx build \
              --platform linux/arm64/v8 \
              --build-arg NEXT_PUBLIC_SITE_URL=${SITE_URL} \
              --tag ${IMAGE_NAME}:${BUILD_NUMBER} \
              --push \
              .
          '''
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
