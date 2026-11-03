pipeline {
    agent {
        // needs Node 24 (see .nvmrc); pnpm is pinned via package.json "packageManager"
        label 'self'
    }
    stages {
        stage('install') {
            steps {
                sh 'corepack enable pnpm'
                sh 'pnpm install --frozen-lockfile'
            }
        }
        stage('build') {
            steps {
                sh 'pnpm build'
            }
        }
        stage('archive') {
            steps {
                publishHTML(target: [allowMissing: false, alwaysLinkToLastBuild: true, keepAll: true, reportDir: 'dist', reportFiles: 'index.html', reportName: 'Web Site'])
                dir('dist') {
                    sh 'tar cvfz ../cruftex.net.tar.gz ./*'
                }
                archive 'cruftex.net.tar.gz'
            }
        }
    }
}
