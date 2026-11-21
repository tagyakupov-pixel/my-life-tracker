@echo off
chcp 65001 >nul
title Публикация репозитория на GitHub
cd /d "%~dp0"

echo ======================================================================
echo           Публикация проекта в ваш репозиторий на GitHub
echo ======================================================================
echo.
echo 1. Создайте пустой репозиторий на https://github.com/new
echo    (не ставьте галочки "Add README" или "Add .gitignore")
echo 2. Скопируйте ссылку на созданный репозиторий 
echo    (например: https://github.com/ваш_логин/schedule-bot.git)
echo.
set /p REPO_URL="Вставьте ссылку на репозиторий GitHub и нажмите Enter: "

if "%REPO_URL%"=="" (
    echo.
    echo [ОШИБКА] Ссылка не была введена. Попробуйте снова.
    pause
    exit /b
)

echo.
echo Подключение удаленного репозитория...
git remote remove origin 2>nul
git remote add origin %REPO_URL%

echo.
echo Отправка ветки main на GitHub...
git branch -M main
git push -u origin main

if errorlevel 1 (
    echo.
    echo [ВНИМАНИЕ] Если GitHub запросил логин/пароль или произошла ошибка,
    echo убедитесь, что вы авторизованы в Git на этом компьютере
    echo (через Personal Access Token или GitHub Desktop / SSH).
) else (
    echo.
    echo ======================================================================
    echo   [УСПЕХ] Проект успешно опубликован на вашем GitHub!
    echo ======================================================================
)

pause
