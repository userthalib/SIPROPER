@echo off
setlocal
echo ==================================================
echo SIPROPER PUSAKA - Setup Windows
echo ==================================================
echo.

echo [1/3] Install root dev tools (concurrently)...
call npm.cmd install
if errorlevel 1 goto :err

echo.
echo [2/3] Install SERVER dependencies...
pushd server
call npm.cmd install
if errorlevel 1 goto :err
popd

echo.
echo [3/3] Install CLIENT dependencies...
pushd client
call npm.cmd install
if errorlevel 1 goto :err
popd

echo.
echo Setup selesai.
echo Jalankan: npm run dev
echo.
exit /b 0

:err
echo.
echo ERROR: Setup gagal.
echo Tips: coba jalankan CMD sebagai Administrator, tutup VS Code, dan pastikan tidak ada node.exe yang sedang berjalan.
echo.
exit /b 1
