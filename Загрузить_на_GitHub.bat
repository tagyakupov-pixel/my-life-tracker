@echo off
chcp 65001 >nul
title Отправка проекта на GitHub
cd /d "%~dp0"

echo ======================================================================
echo           Отправка проекта на GitHub (my-life-tracker)
echo ======================================================================
echo.
echo Репозиторий: https://github.com/tagyakupov-pixel/my-life-tracker.git
echo Ветка: main
echo.
echo Выполняется отправка...
echo (Если откроется окно входа GitHub — нажмите "Sign in with your browser" / "Authorize")
echo.

git remote remove origin 2>nul
git remote add origin https://github.com/tagyakupov-pixel/my-life-tracker.git
git branch -M main
git push -u origin main

if errorlevel 1 (
    echo.
    echo ======================================================================
    echo [ВНИМАНИЕ] Отправка не удалась.
    echo.
    echo 1. Убедитесь, что репозиторий создан на сайте GitHub:
    echo    Перейдите на https://github.com/tagyakupov-pixel/my-life-tracker
    echo    Если страница выдает 404, создайте его на https://github.com/new
    echo    (Имя: my-life-tracker, галочки README/gitignore НЕ ставить!)
    echo.
    echo 2. Если Git запросил пароль:
    echo    GitHub не принимает обычные пароли. Создайте токен доступа:
    echo    https://github.com/settings/tokens (галочка: repo)
    echo    и вставьте его вместо пароля.
    echo ======================================================================
) else (
    echo.
    echo ======================================================================
    echo   [УСПЕХ] Проект успешно опубликован на вашем GitHub!
    echo   Ссылка: https://github.com/tagyakupov-pixel/my-life-tracker
    echo ======================================================================
)

echo.
pause
