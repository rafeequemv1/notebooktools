$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$repo = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$srcDefault = Join-Path $repo "assets\logo-source.png"
$srcCursor = "C:\Users\nahal\.cursor\projects\c-rafeeque-apps-notebooktools\assets\c__Users_nahal_AppData_Roaming_Cursor_User_workspaceStorage_f8addfe3e0384ffe942e89e42d71d06b_images_image-9ba276af-3a74-43b6-a504-afc5b0aa4e33.png"

if (-not (Test-Path $srcDefault) -and (Test-Path $srcCursor)) {
    New-Item -ItemType Directory -Force -Path (Split-Path $srcDefault) | Out-Null
    Copy-Item $srcCursor $srcDefault -Force
}

$srcPath = $srcDefault
if (-not (Test-Path $srcPath)) { throw "Logo source not found: $srcPath" }

function Get-Font([string]$family, [float]$size, [string]$style = "Regular") {
    $fs = [System.Drawing.FontStyle]::Regular
    if ($style -eq "Bold") { $fs = [System.Drawing.FontStyle]::Bold }
    return New-Object System.Drawing.Font($family, $size, $fs, [System.Drawing.GraphicsUnit]::Pixel)
}

function Save-Png($bmp, [string]$path) {
    $dir = Split-Path $path -Parent
    if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
}

function Export-SquareIcon($source, [string]$dest, [int]$size, $bg = $null) {
    $src = [System.Drawing.Image]::FromFile($source)
    $side = [Math]::Min($src.Width, $src.Height)
    $sx = [int](($src.Width - $side) / 2)
    $sy = [int](($src.Height - $side) / 2)

    $bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    if ($bg) { $g.Clear($bg) } else { $g.Clear([System.Drawing.Color]::Transparent) }

    $g.DrawImage($src, (New-Object System.Drawing.Rectangle 0, 0, $size, $size),
        (New-Object System.Drawing.Rectangle $sx, $sy, $side, $side), [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose()
    Save-Png $bmp $dest
    $bmp.Dispose()
    $src.Dispose()
}

function Export-Wordmark($source, [string]$dest, [int]$height) {
    $src = [System.Drawing.Image]::FromFile($source)
    $side = [Math]::Min($src.Width, $src.Height)
    $sx = [int](($src.Width - $side) / 2)
    $sy = [int](($src.Height - $side) / 2)

    $markSize = $height - 2
    $font = Get-Font "Segoe UI" ($height * 0.58) "Bold"
    $text = "NotebookTools"
    $measure = New-Object System.Drawing.Bitmap 1, 1
    $mg = [System.Drawing.Graphics]::FromImage($measure)
    $textW = [int]$mg.MeasureString($text, $font).Width
    $mg.Dispose(); $measure.Dispose()

    $padL = 2
    $gap = [int]($height * 0.28)
    $totalW = $padL + $markSize + $gap + $textW + 8
    $bmp = New-Object System.Drawing.Bitmap $totalW, $height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
    $g.Clear([System.Drawing.Color]::Transparent)

    $g.DrawImage($src, (New-Object System.Drawing.Rectangle $padL, 1, $markSize, $markSize),
        (New-Object System.Drawing.Rectangle $sx, $sy, $side, $side), [System.Drawing.GraphicsUnit]::Pixel)

    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(12, 12, 12))
    $g.DrawString($text, $font, $brush, ($padL + $markSize + $gap), ($height - $font.Size) / 2 - 1)
    $brush.Dispose(); $font.Dispose(); $g.Dispose()
    Save-Png $bmp $dest
    $bmp.Dispose()
    $src.Dispose()
}

$targets = @(
    (Join-Path $repo "notebooktools-extension\icons"),
    (Join-Path $repo "version 0.1\extension\icons")
)

foreach ($dir in $targets) {
    Export-SquareIcon $srcPath (Join-Path $dir "icon16.png") 16
    Export-SquareIcon $srcPath (Join-Path $dir "icon48.png") 48
    Export-SquareIcon $srcPath (Join-Path $dir "icon128.png") 128
    Write-Host "Icons -> $dir"
}

foreach ($ext in @("notebooktools-extension", "version 0.1\extension")) {
    $base = Join-Path $repo $ext
    Export-Wordmark $srcPath (Join-Path $base "logo.png") 40
    Copy-Item $srcPath (Join-Path $base "logo-mark.png") -Force
    Write-Host "Logo -> $base"
}

$web = Join-Path $repo "website\assets"
Export-SquareIcon $srcPath (Join-Path $web "favicon.png") 32 ([System.Drawing.Color]::White)
Export-SquareIcon $srcPath (Join-Path $web "logo-mark.png") 128 ([System.Drawing.Color]::Transparent)
Export-SquareIcon $srcPath (Join-Path $web "logo-mark-32.png") 32 ([System.Drawing.Color]::Transparent)
Export-SquareIcon $srcPath (Join-Path $web "og-image.png") 512 ([System.Drawing.Color]::White)
Export-Wordmark $srcPath (Join-Path $web "logo-wordmark.png") 48
Export-Wordmark $srcPath (Join-Path $web "logo-wordmark-sm.png") 32
Write-Host "Website assets -> $web"

# Store assets source
$storeSrc = Join-Path $repo "version 0.1\store-assets\logo-source.png"
Copy-Item $srcPath $storeSrc -Force
Export-SquareIcon $srcPath (Join-Path $repo "version 0.1\store-assets\store-icon-128.png") 128 ([System.Drawing.Color]::White)
Write-Host "Store icon updated"

Write-Host "Done."
