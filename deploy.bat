git add .
git commit -m "fix: new fix"
git push origin main
ssh pachas "cd /var/www/pachas && sudo -u nodeuser git pull origin main"
ssh pachas "cd /var/www/pachas && sudo -u nodeuser npm build"
ssh pachas "cd /var/www/pachas && sudo systemctl restart pachas.service"
