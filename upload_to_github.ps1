[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "Публикация репозитория на GitHub"

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "          Публикация проекта в GitHub [my-life-tracker]" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Репозиторий: https://github.com/tagyakupov-pixel/my-life-tracker.git" -ForegroundColor Yellow
Write-Host "Ветка: main" -ForegroundColor Yellow
Write-Host ""

$repoUrl = "https://github.com/tagyakupov-pixel/my-life-tracker.git"

# Настраиваем remote origin
git remote remove origin 2>$null
git remote add origin $repoUrl
git branch -M main

Write-Host "Отправка файлов на GitHub..." -ForegroundColor Green
Write-Host "(Если откроется окно браузера от GitHub — подтвердите вход)" -ForegroundColor Gray
Write-Host ""

git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "======================================================================" -ForegroundColor Green
    Write-Host "  [УСПЕХ] Проект успешно опубликован на вашем GitHub!" -ForegroundColor Green
    Write-Host "  Ссылка: https://github.com/tagyakupov-pixel/my-life-tracker" -ForegroundColor Green
    Write-Host "======================================================================" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "======================================================================" -ForegroundColor Red
    Write-Host "  [ВНИМАНИЕ] Если отправка не удалась:" -ForegroundColor Red
    Write-Host "======================================================================" -ForegroundColor Red
    Write-Host "1. Убедитесь, что репозиторий создан на сайте GitHub:" -ForegroundColor Yellow
    Write-Host "   Перейдите по ссылке: https://github.com/new"
    Write-Host "   Имя: my-life-tracker (галочки README и .gitignore НЕ ставить!)"
    Write-Host ""
    Write-Host "2. Авторизация:" -ForegroundColor Yellow
    Write-Host "   Если Git запросил пароль, GitHub требует Personal Access Token вместо пароля:"
    Write-Host "   Создайте токен на https://github.com/settings/tokens (галочка: repo)"
    Write-Host "======================================================================" -ForegroundColor Red
}

Write-Host ""
Read-Host "Нажмите Enter для выхода"
