Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$logoPath = Join-Path $root "..\frontend\public\logo2.png"
$outDir = $root

Write-Host "Generando imagenes del instalador..."

# --- Installer Header (150x57 BMP) ---
$img = [System.Drawing.Image]::FromFile((Resolve-Path $logoPath))
$bmp = New-Object System.Drawing.Bitmap(150, 57)
$graphics = [System.Drawing.Graphics]::FromImage($bmp)
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graphics.DrawImage($img, 0, 0, 150, 57)
$headerPath = Join-Path $outDir "installerHeader.bmp"
$bmp.Save($headerPath, [System.Drawing.Imaging.ImageFormat]::Bmp)
$graphics.Dispose()
$bmp.Dispose()
Write-Host "  OK: installerHeader.bmp (150x57)"

# --- Installer Sidebar (164x314 BMP) ---
$img = [System.Drawing.Image]::FromFile((Resolve-Path $logoPath))
$bmp = New-Object System.Drawing.Bitmap(164, 314)
$graphics = [System.Drawing.Graphics]::FromImage($bmp)
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

# Dark gradient background
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  (New-Object System.Drawing.Point(0, 0)),
  (New-Object System.Drawing.Point(0, 314)),
  [System.Drawing.Color]::FromArgb(15, 23, 42),
  [System.Drawing.Color]::FromArgb(30, 41, 59)
)
$graphics.FillRectangle($brush, 0, 0, 164, 314)

# Draw logo centered
$logoW = 140
$logoH = [int]($img.Height * ($logoW / $img.Width))
$logoX = [int]((164 - $logoW) / 2)
$logoY = [int]((314 - $logoH) / 2) - 20
$graphics.DrawImage($img, $logoX, $logoY, $logoW, $logoH)

# Draw developer text
$font = New-Object System.Drawing.Font("Segoe UI", 8, [System.Drawing.FontStyle]::Regular)
$brush2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(148, 163, 184))
$text = "Charles-X`nRedFlame Systems"
$format = New-Object System.Drawing.StringFormat
$format.Alignment = [System.Drawing.StringAlignment]::Center
$rect = New-Object System.Drawing.RectangleF(0, 260, 164, 50)
$graphics.DrawString($text, $font, $brush2, $rect, $format)

$sidebarPath = Join-Path $outDir "installerSidebar.bmp"
$bmp.Save($sidebarPath, [System.Drawing.Imaging.ImageFormat]::Bmp)
$graphics.Dispose()
$bmp.Dispose()
$brush.Dispose()
$brush2.Dispose()
$font.Dispose()
Write-Host "  OK: installerSidebar.bmp (164x314)"

Write-Host "Listo!"
