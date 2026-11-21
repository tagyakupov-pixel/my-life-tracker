@echo off
chcp 65001 >nul
title Отправка проекта на GitHub
cd /d "%~dp0"

echo ======================================================================
echo           Отправка проекта на GitHub [my-life-tracker]
echo ======================================================================
echo.
echo Репозиторий: https://github.com/tagyakupov-pixel/my-life-tracker.git
echo Ветка: main
echo.
echo Выполняется отправка...
echo.

git remote remove origin 2>nul
git remote add origin https://github.com/tagyakupov-pixel/my-life-tracker.git
git branch -M main
git push -u origin main

if errorlevel 1 goto ERROR_PUSH
goto SUCCESS_PUSH

:ERROR_PUSH
echo.
echo ======================================================================
echo [ВНИМАНИЕ] Отправка не удалась.
echo.
echo Возможные причины:
echo 1. Репозиторий еще не создан на сайте GitHub:
echo    Проверьте адрес: https://github.com/tagyakupov-pixel/my-life-tracker
echo    Если страницы нет, создайте его на https://github.com/new
echo    [Имя: my-life-tracker, галочки README и gitignore не ставить]
echo.
echo 2. Требуется авторизация в GitHub:
echo    GitHub больше не принимает обычные пароли.
echo    Если Git запросил пароль, создайте Personal Access Token:
echo    https://github.com/settings/tokens [права: repo]
echo    и вставьте его вместо пароля.
echo ======================================================================
echo.
pause
exit /b 1

:SUCCESS_PUSH
echo.
echo ======================================================================
echo   [УСПЕХ] Проект успешно опубликован на вашем GitHub!
echo   Ссылка: https://github.com/tagyakupov-pixel/my-life-tracker
echo ======================================================================
echo.
pause
exit /b 0
