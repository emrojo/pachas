git add .
git commit -m "fix: new fix"
git push origin main
ssh pachas "cd /var/www/pachas && ./deploy.sh"
ssh pachas "cd /var/www/pachas && ./build.sh"
ssh pachas "cd /var/www/pachas && ./service.sh restart"
