pipeline {
    agent {
        // FIXME: we need a node with npm/node installed?
        label 'self'
    }
    stages {
        stage('npm install') {
            steps {
                sh 'npm install'
            }
        }
        stage('hexo generate') {
            steps {
                sh './hexo generate --drafts'
            }
        }
      	stage('archive') {
          	steps {
                publishHTML(target: [allowMissing: false, alwaysLinkToLastBuild: true, keepAll: true, reportDir: 'public', reportFiles: 'index.html', reportName: 'Web Site'])
        		dir('public') {
            		sh 'tar cvfz ../cruftex.net.tar.gz ./*'
        		}
        		archive 'cruftex.net.tar.gz'
    		}
        }
    }
}
