@echo off
chcp 65001 >nul
title Публикация репозитория на GitHub
cd /d "%~dp0"

echo ======================================================================
echo           Публикация проекта в ваш репозиторий на GitHub
echo ======================================================================
echo.

:: Получаем текущий origin (если есть)
for /f "tokens=*" %%i in ('git remote get-url origin 2^>nul') do set CURRENT_ORIGIN=%%i

if not "%CURRENT_ORIGIN%"=="" (
    echo [INFO] Текущий привязанный репозиторий:
    echo        %CURRENT_ORIGIN%
    echo.
    echo Нажмите [ENTER], чтобы отправить код по этому адресу.
    echo Или вставьте новую ссылку на репозиторий:
    set /p REPO_INPUT="> "
) else (
    echo 1. Убедитесь, что репозиторий создан на https://github.com/new
    echo    (например, с именем my-life-tracker; галочки README/gitignore НЕ ставьте!)
    echo 2. Вставьте ссылку на репозиторий:
    set /p REPO_INPUT="> "
)

:: Если пользователь нажал Enter при наличии CURRENT_ORIGIN, используем его
if "%REPO_INPUT%"=="" (
    if not "%CURRENT_ORIGIN%"=="" (
        set TARGET_URL=%CURRENT_ORIGIN%
    ) else (
        echo.
        echo [ОШИБКА] Ссылка не была введена.
        pause
        exit /b
    )
) else (
    set TARGET_URL=%REPO_INPUT%
)

:: Очистка от кавычек и случайных задвоений (через powershell)
for /f "usebackq tokens=*" %%u in (`powershell -NoProfile -Command "$url = '%TARGET_URL%'.Replace('\"','').Trim(); if ($url -match '(https://github\.com/[^/\s]+/[^/\s]+?(\.git)?)$') { $matches[1] } else { $url }"`) do set TARGET_URL=%%u

:: Добавляем .git в конец, если его нет
for /f "usebackq tokens=*" %%u in (`powershell -NoProfile -Command "if ('%TARGET_URL%'.EndsWith('.git')) { '%TARGET_URL%' } else { '%TARGET_URL%' + '.git' }"`) do set TARGET_URL=%%u

echo.
echo Целевой репозиторий: %TARGET_URL%
echo.

git remote remove origin 2>nul
git remote add origin %TARGET_URL%

echo Отправка ветки main на GitHub...
echo (Если откроется окно браузера от GitHub — подтвердите авторизацию в 1 клик)
echo.

git branch -M main
git push -u origin main

if errorlevel 1 (
    echo.
    echo ======================================================================
    echo [ВНИМАНИЕ] Отправка не удалась. Возможные причины:
    echo 1. Репозиторий еще НЕ создан на https://github.com/new
    echo    (Зайдите на https://github.com/new и создайте репозиторий с нужным именем).
    echo 2. Требуется авторизация в GitHub:
    echo    - Если Git запросил пароль: GitHub больше не принимает обычный пароль от аккаунта!
    echo      Вместо пароля используйте Personal Access Token:
    echo      https://github.com/settings/tokens (права: repo).
    echo    - Или выполните в терминале: gh auth login
    echo ======================================================================
) else (
    echo.
    echo ======================================================================
    echo   [УСПЕХ] Проект успешно опубликован на вашем GitHub!
    echo   Ссылка: %TARGET_URL%
    echo ======================================================================
)

echo.
pause
