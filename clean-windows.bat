@echo off
setlocal
echo ==================================================
echo SIPROPER PUSAKA - Clean Windows (hapus node_modules)
echo ==================================================
echo.

echo Menghentikan proses node.exe (jika ada)...
taskkill /F /IM node.exe >NUL 2>NUL

echo Menghapus node_modules...
rmdir /s /q node_modules 2>NUL
rmdir /s /q server\node_modules 2>NUL
rmdir /s /q client\node_modules 2>NUL

echo Menghapus package-lock (jika ada)...
del /f /q package-lock.json 2>NUL
del /f /q server\package-lock.json 2>NUL
del /f /q client\package-lock.json 2>NUL

echo.
echo Selesai. Sekarang jalankan:
echo   setup-windows.bat
echo atau:
echo   npm run setup:win
echo.
exit /b 0
