@echo off
echo Syncing changes to GitHub...
git add .
git commit -m "Auto-update website content (Keep + Goodreads)"
git push origin master
echo.
echo ===========================================
echo Success! Changes pushed to GitHub Pages.
echo ===========================================
pause
