git add .
git commit -m "fix: new fix"
git push origin main
ssh pachas ./deploy.sh
ssh pachas ./build.sh
ssh pachas ./service.sh restart
