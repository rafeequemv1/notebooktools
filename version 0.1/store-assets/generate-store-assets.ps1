$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$outDir = $here
$iconSrc = Join-Path $here "logo-source.png"
if (-not (Test-Path $iconSrc)) {
    $iconSrc = Join-Path (Split-Path -Parent $here) "extension\icons\icon128.png"
}

# Brand
$script:BgTop    = [System.Drawing.Color]::FromArgb(253, 251, 247)
$script:BgBottom = [System.Drawing.Color]::FromArgb(232, 240, 254)
$script:Paper    = [System.Drawing.Color]::FromArgb(255, 255, 255)
$script:PaperEdge = [System.Drawing.Color]::FromArgb(240, 236, 228)
$script:Ink      = [System.Drawing.Color]::FromArgb(12, 12, 12)
$script:Muted    = [System.Drawing.Color]::FromArgb(95, 99, 104)
$script:Subtle   = [System.Drawing.Color]::FromArgb(154, 160, 166)
$script:Accent   = [System.Drawing.Color]::FromArgb(26, 115, 232)
$script:Accent2  = [System.Drawing.Color]::FromArgb(66, 133, 244)
$script:Blue     = [System.Drawing.Color]::FromArgb(66, 133, 244)
$script:Green    = [System.Drawing.Color]::FromArgb(52, 168, 83)
$script:Yellow   = [System.Drawing.Color]::FromArgb(251, 188, 4)
$script:Red      = [System.Drawing.Color]::FromArgb(234, 67, 53)
$script:YouTube  = [System.Drawing.Color]::FromArgb(255, 0, 0)
$script:Shadow   = [System.Drawing.Color]::FromArgb(28, 12, 12, 12)

$script:LogoImage = $null
if (Test-Path $iconSrc) {
    $script:LogoImage = [System.Drawing.Image]::FromFile($iconSrc)
}

function New-Bitmap([int]$w, [int]$h) {
    $bmp = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    Fill-PremiumBg $g $w $h
    return @{ Bitmap = $bmp; Graphics = $g }
}

function New-Rect([float]$x, [float]$y, [float]$w, [float]$h) {
    return New-Object System.Drawing.Rectangle ([int]$x), ([int]$y), ([int]$w), ([int]$h)
}

function Fill-PremiumBg($g, [int]$w, [int]$h) {
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
        (New-Rect 0 0 $w $h),
        $script:BgTop, $script:BgBottom, 135
    )
    $g.FillRectangle($brush, 0, 0, $w, $h)
    $brush.Dispose()
    $glowBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(36, 66, 133, 244))
    $g.FillEllipse($glowBrush, [int]($w * 0.5), [int](-($h * 0.05)), [int]($w * 0.5), [int]($h * 0.45))
    $glowBrush.Dispose()
}

function Save-RgbPng($bmp, [string]$path) {
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
}

function Dispose-Canvas($canvas) {
    $canvas.Graphics.Dispose()
    $canvas.Bitmap.Dispose()
}

function Get-Font([string]$family, [float]$size, [string]$style = "Regular") {
    $fs = [System.Drawing.FontStyle]::Regular
    if ($style -eq "Bold") { $fs = [System.Drawing.FontStyle]::Bold }
    return New-Object System.Drawing.Font($family, $size, $fs, [System.Drawing.GraphicsUnit]::Pixel)
}

function Draw-Text($g, [string]$text, $font, $brush, [float]$x, [float]$y) {
    $g.DrawString($text, $font, $brush, $x, $y)
}

function Measure-TextW($g, [string]$text, $font) {
    return $g.MeasureString($text, $font).Width
}

function New-RoundPath([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = [Math]::Min($r * 2, [Math]::Min($w, $h))
    $path.AddArc($x, $y, $d, $d, 180, 90)
    $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
    $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
    $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    return $path
}

function Fill-RoundRect($g, $brush, [float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
    $path = New-RoundPath $x $y $w $h $r
    $g.FillPath($brush, $path)
    $path.Dispose()
}

function Draw-RoundRect($g, $pen, [float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
    $path = New-RoundPath $x $y $w $h $r
    $g.DrawPath($pen, $path)
    $path.Dispose()
}

function Draw-PaperCard($g, [float]$x, [float]$y, [float]$w, [float]$h, [float]$r = 16) {
    $sh = New-Object System.Drawing.SolidBrush $script:Shadow
    Fill-RoundRect $g $sh ($x + 3) ($y + 8) $w $h $r
    $sh.Dispose()
    $paper = New-Object System.Drawing.SolidBrush $script:Paper
    Fill-RoundRect $g $paper $x $y $w $h $r
    $pen = New-Object System.Drawing.Pen $script:PaperEdge, 1.2
    Draw-RoundRect $g $pen $x $y $w $h $r
    $pen.Dispose()
    $paper.Dispose()
}

function Draw-Logo($g, [float]$x, [float]$y, [float]$size) {
    if ($script:LogoImage) {
        $g.DrawImage($script:LogoImage, $x, $y, $size, $size)
    }
}

function Draw-BrandHeader($g, [float]$x, [float]$y, [float]$markSize = 44) {
    Draw-Logo $g $x $y $markSize
    $font = Get-Font "Segoe UI" 26
    $brush = New-Object System.Drawing.SolidBrush $script:Ink
    Draw-Text $g "NotebookTools" $font $brush ($x + $markSize + 14) ($y + 8)
    $font.Dispose(); $brush.Dispose()
}

function Draw-RainbowBar($g, [float]$x, [float]$y, [float]$w, [float]$h) {
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
        (New-Rect $x $y $w $h),
        $script:Blue, $script:Red, 0
    )
    $g.FillRectangle($brush, $x, $y, $w, $h)
    $brush.Dispose()
}

function Draw-Step($g, [int]$num, [float]$x, [float]$y, [string]$title, [string]$desc) {
    Draw-PaperCard $g $x $y 220 110 14
    $badge = New-Object System.Drawing.SolidBrush $script:Accent
    Fill-RoundRect $g $badge ($x + 16) ($y + 16) 28 28 14
    $wf = Get-Font "Segoe UI" 14 "Bold"
    $wb = New-Object System.Drawing.SolidBrush $script:Paper
    $nw = Measure-TextW $g "$num" $wf
    Draw-Text $g "$num" $wf $wb ($x + 16 + (28 - $nw) / 2) ($y + 20)
    $tf = Get-Font "Segoe UI" 15 "Bold"
    $tb = New-Object System.Drawing.SolidBrush $script:Ink
    Draw-Text $g $title $tf $tb ($x + 54) ($y + 18)
    $df = Get-Font "Segoe UI" 12
    $db = New-Object System.Drawing.SolidBrush $script:Muted
    Draw-Text $g $desc $df $db ($x + 16) ($y + 58)
    $badge.Dispose(); $wf.Dispose(); $wb.Dispose(); $tf.Dispose(); $tb.Dispose(); $df.Dispose(); $db.Dispose()
}

function Draw-Arrow($g, [float]$x1, [float]$y1, [float]$x2, [float]$y2) {
    $pen = New-Object System.Drawing.Pen $script:Accent, 2.5
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::ArrowAnchor
    $g.DrawLine($pen, $x1, $y1, $x2, $y2)
    $pen.Dispose()
}

function Draw-Pill($g, [string]$text, [float]$x, [float]$y, $bg, $fg, [float]$fontSize = 13) {
    $font = Get-Font "Segoe UI" $fontSize
    $tw = Measure-TextW $g $text $font
    $pw = $tw + 24
    $ph = 30
    $b = New-Object System.Drawing.SolidBrush $bg
    Fill-RoundRect $g $b $x $y $pw $ph 15
    $fb = New-Object System.Drawing.SolidBrush $fg
    Draw-Text $g $text $font $fb ($x + 12) ($y + 6)
    $b.Dispose(); $fb.Dispose(); $font.Dispose()
    return $pw
}

function Draw-PrimaryBtn($g, [string]$text, [float]$x, [float]$y, [float]$w) {
    $grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
        (New-Rect $x $y $w 44),
        $script:Accent2, $script:Accent, 90
    )
    Fill-RoundRect $g $grad $x $y $w 44 8
    $grad.Dispose()
    $font = Get-Font "Segoe UI" 15 "Bold"
    $brush = New-Object System.Drawing.SolidBrush $script:Paper
    $tw = Measure-TextW $g $text $font
    Draw-Text $g $text $font $brush ($x + ($w - $tw) / 2) ($y + 12)
    $font.Dispose(); $brush.Dispose()
}

# --- Store icon ---
$iconOut = Join-Path $outDir "store-icon-128.png"
if ($script:LogoImage) {
    $iconBmp = New-Object System.Drawing.Bitmap 128, 128, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $ig = [System.Drawing.Graphics]::FromImage($iconBmp)
    $ig.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $ig.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $ig.Clear($script:Paper)
    $ig.DrawImage($script:LogoImage, 0, 0, 128, 128)
    $ig.Dispose()
    Save-RgbPng $iconBmp $iconOut
    $iconBmp.Dispose()
}
Write-Host "Created store-icon-128.png"

# --- Screenshot 1: Outcome ---
$c = New-Bitmap 1280 800
$g = $c.Graphics
Draw-RainbowBar $g 0 0 1280 5
Draw-BrandHeader $g 72 48 44
$outcome = Get-Font "Segoe UI" 44 "Bold"
$tb = New-Object System.Drawing.SolidBrush $script:Ink
Draw-Text $g "Your sources. One notebook." $outcome $tb 72 118
Draw-Text $g "Ready to ask NotebookLM anything." (Get-Font "Segoe UI" 44 "Bold") $tb 72 172
$lb = New-Object System.Drawing.SolidBrush $script:Muted
Draw-Text $g "Videos, articles, posts, and highlights - imported in seconds." (Get-Font "Segoe UI" 20) $lb 72 240

Draw-PaperCard $g 72 310 520 400 18
Draw-Text $g "Before: scattered tabs" (Get-Font "Segoe UI" 14 "Bold") $lb 100 340
$by = 372
foreach ($t in @("youtube.com/watch?v=...", "article-open-in-tab", "x.com/thread/...", "highlighted quote")) {
    Fill-RoundRect $g (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(253, 251, 247))) 100 $by 460 44 8
    Draw-Text $g $t (Get-Font "Segoe UI" 13) $tb 116 ($by + 12)
    $by += 52
}
Draw-Arrow $g 620 500 680 500
Draw-PaperCard $g 700 310 508 400 18
Draw-Logo $g 730 340 48
Draw-Text $g "After: NotebookLM notebook" (Get-Font "Segoe UI" 14 "Bold") $lb 790 348
$iy = 400
foreach ($s in @("YouTube: Research lecture", "Web: Industry report", "X: Expert thread", "Text: Key quote")) {
    Fill-RoundRect $g (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(232, 240, 254))) 730 $iy 448 48 8
    Draw-Text $g $s (Get-Font "Segoe UI" 13 "Bold") $tb 746 ($iy + 14)
    $iy += 58
}
Fill-RoundRect $g (New-Object System.Drawing.SolidBrush $script:Green) 730 640 280 40 8
Draw-Text $g "Ask across all sources" (Get-Font "Segoe UI" 14 "Bold") (New-Object System.Drawing.SolidBrush $script:Paper) 790 650
Save-RgbPng $c.Bitmap (Join-Path $outDir "screenshot-01-outcome.png")
Dispose-Canvas $c
Write-Host "Created screenshot-01-outcome.png"

# --- Screenshot 2: YouTube ---
$c = New-Bitmap 1280 800
$g = $c.Graphics
Draw-RainbowBar $g 0 0 1280 5
Draw-BrandHeader $g 72 40 40
Draw-Text $g "YouTube to NotebookLM" (Get-Font "Segoe UI" 36 "Bold") $tb 72 108
Draw-Text $g "Outcome: video becomes a source you can query" (Get-Font "Segoe UI" 18) $lb 72 158
Draw-PaperCard $g 72 200 1136 500 18
$yt = New-Object System.Drawing.SolidBrush $script:YouTube
$g.FillRectangle($yt, 100, 230, 1100, 44)
Draw-Text $g "youtube.com" (Get-Font "Segoe UI" 17 "Bold") (New-Object System.Drawing.SolidBrush $script:Paper) 118 240
Fill-RoundRect $g (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(18, 18, 18))) 100 290 1100 300 10
Draw-PaperCard $g 880 248 300 52 26
Draw-Logo $g 892 254 40
Draw-Text $g "NotebookLM" (Get-Font "Segoe UI" 15 "Bold") $tb 940 264
$hl = New-Object System.Drawing.Pen $script:Accent, 3
Draw-RoundRect $g $hl 876 244 308 60 26
$hl.Dispose()
Draw-Arrow $g 640 620 760 620
Draw-PaperCard $g 780 580 380 90 12
Draw-Text $g "Added to your notebook" (Get-Font "Segoe UI" 18 "Bold") $tb 820 612
Save-RgbPng $c.Bitmap (Join-Path $outDir "screenshot-02-youtube.png")
Dispose-Canvas $c
Write-Host "Created screenshot-02-youtube.png"

# --- Screenshot 3: Right-click highlight ---
$c = New-Bitmap 1280 800
$g = $c.Graphics
Draw-RainbowBar $g 0 0 1280 5
Draw-BrandHeader $g 72 40 40
Draw-Text $g "Right-click any highlight" (Get-Font "Segoe UI" 36 "Bold") $tb 72 108
Draw-Text $g "Outcome: selection saved as a NotebookLM text source" (Get-Font "Segoe UI" 18) $lb 72 158
Draw-PaperCard $g 72 200 560 480 18
Fill-RoundRect $g (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(253, 251, 247))) 100 240 500 160 10
Draw-Text $g "The most important finding from the report" (Get-Font "Segoe UI" 16) $tb 120 280
$hlBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 249, 196))
$g.FillRectangle($hlBrush, 120, 320, 420, 32)
Draw-Text $g "was the shift in user behavior in Q3." (Get-Font "Segoe UI" 15 "Bold") $tb 128 326
$hlBrush.Dispose()
Draw-PaperCard $g 120 420 300 200 12
Draw-Text $g "Add to NotebookLM" (Get-Font "Segoe UI" 16 "Bold") $tb 150 450
$accentBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(232, 240, 254))
Fill-RoundRect $g $accentBrush 130 490 260 36 6
Draw-Text $g "Add to NotebookLM" (Get-Font "Segoe UI" 13 "Bold") $tb 150 498
$accentBrush.Dispose()
Draw-Text $g "Copy" (Get-Font "Segoe UI" 12) $lb 150 540
Draw-PaperCard $g 680 280 528 360 18
Draw-Step $g 1 710 320 "Highlight text" "Select the passage you need"
Draw-Step $g 2 710 450 "Right-click" "Choose Add to NotebookLM"
Draw-Step $g 3 710 580 "Pick notebook" "Source ready to query"
Save-RgbPng $c.Bitmap (Join-Path $outDir "screenshot-03-rightclick.png")
Dispose-Canvas $c
Write-Host "Created screenshot-03-rightclick.png"

# --- Screenshot 4: Popup webpage ---
$c = New-Bitmap 1280 800
$g = $c.Graphics
Draw-RainbowBar $g 0 0 1280 5
Draw-BrandHeader $g 72 40 40
Draw-Text $g "Import any webpage" (Get-Font "Segoe UI" 36 "Bold") $tb 72 108
Draw-Text $g "Outcome: current tab URL added to your notebook" (Get-Font "Segoe UI" 18) $lb 72 158
Draw-PaperCard $g 360 190 560 500 18
Draw-Logo $g 390 220 40
Draw-Text $g "NotebookTools" (Get-Font "Segoe UI" 18 "Bold") $tb 440 230
Draw-PrimaryBtn $g "Webpage" 390 280 110
Fill-RoundRect $g (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(246, 242, 234))) 510 280 100 44 8
Draw-Text $g "YouTube" (Get-Font "Segoe UI" 13) $lb 528 292
Draw-Text $g "Current page" (Get-Font "Segoe UI" 12 "Bold") $lb 390 350
Fill-RoundRect $g (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(253, 251, 247))) 390 372 500 40 8
Draw-Text $g "https://research-article.com/report" (Get-Font "Segoe UI" 13) $tb 404 382
Draw-Text $g "Notebook" (Get-Font "Segoe UI" 12 "Bold") $lb 390 430
Fill-RoundRect $g (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(253, 251, 247))) 390 452 500 40 8
Draw-Text $g "Research notes" (Get-Font "Segoe UI" 13) $tb 404 462
Draw-PrimaryBtn $g "Import webpage" 390 520 500
Draw-Arrow $g 200 400 340 400
Draw-PaperCard $g 72 340 200 120 12
Draw-Text $g "1 click" (Get-Font "Segoe UI" 22 "Bold") $tb 110 390
Save-RgbPng $c.Bitmap (Join-Path $outDir "screenshot-04-popup.png")
Dispose-Canvas $c
Write-Host "Created screenshot-04-popup.png"

# --- Screenshot 5: Query outcome ---
$c = New-Bitmap 1280 800
$g = $c.Graphics
Draw-RainbowBar $g 0 0 1280 5
Draw-BrandHeader $g 72 40 40
Draw-Text $g "Then ask NotebookLM" (Get-Font "Segoe UI" 36 "Bold") $tb 72 108
Draw-Text $g "Synthesize across every source you imported" (Get-Font "Segoe UI" 18) $lb 72 158
Draw-PaperCard $g 72 200 1136 520 18
Draw-Text $g "NotebookLM" (Get-Font "Segoe UI" 22 "Bold") $tb 100 240
Draw-Text $g "Sources in your notebook" (Get-Font "Segoe UI" 13 "Bold") $lb 100 290
$iy = 320
foreach ($s in @("YouTube video", "Web article", "X thread", "Highlighted quote")) {
    Fill-RoundRect $g (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(253, 251, 247))) 100 $iy 420 48 8
    Draw-Logo $g 112 ($iy + 6) 36
    Draw-Text $g $s (Get-Font "Segoe UI" 14) $tb 158 ($iy + 14)
    $iy += 58
}
Fill-RoundRect $g (New-Object System.Drawing.SolidBrush $script:Accent) 580 380 560 120 12
Draw-Text $g "What are the main themes across my sources?" (Get-Font "Segoe UI" 18 "Bold") (New-Object System.Drawing.SolidBrush $script:Paper) 610 420
Draw-Text $g "NotebookLM answers using everything you imported." (Get-Font "Segoe UI" 14) (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 235, 255))) 610 460
Save-RgbPng $c.Bitmap (Join-Path $outDir "screenshot-05-query.png")
Dispose-Canvas $c
Write-Host "Created screenshot-05-query.png"

# --- Small promo 440x280 ---
$c = New-Bitmap 440 280
$g = $c.Graphics
Draw-RainbowBar $g 0 0 440 5
Draw-Logo $g 32 36 72
Draw-Text $g "NotebookTools" (Get-Font "Segoe UI" 24 "Bold") $tb 118 58
Draw-Text $g "Sources to NotebookLM in one click" (Get-Font "Segoe UI" 14) $lb 32 128
$px = 32; $py = 168
foreach ($p in @("YouTube", "Web", "Highlight")) {
    $pw = Draw-Pill $g $p $px $py ([System.Drawing.Color]::FromArgb(232, 240, 254)) $script:Accent 11
    $px += $pw + 8
}
Draw-PrimaryBtn $g "Free on Chrome" 32 220 160
Save-RgbPng $c.Bitmap (Join-Path $outDir "promo-small-440x280.png")
Dispose-Canvas $c
Write-Host "Created promo-small-440x280.png"

# --- Marquee 1400x560 ---
$c = New-Bitmap 1400 560
$g = $c.Graphics
Draw-RainbowBar $g 0 0 1400 6
Draw-Logo $g 100 90 96
Draw-Text $g "NotebookTools" (Get-Font "Segoe UI" 42 "Bold") $tb 220 115
Draw-Text $g "Import YouTube, webpages, X posts, and highlights into NotebookLM" (Get-Font "Segoe UI" 24) $tb 100 230
Draw-Text $g "Right-click any selection  |  Free  |  Your Google sign-in" (Get-Font "Segoe UI" 17) $lb 100 285
$px = 100; $py = 350
foreach ($p in @("YouTube", "X", "Web", "Highlight")) {
    $pw = Draw-Pill $g $p $px $py ([System.Drawing.Color]::FromArgb(246, 242, 234)) $script:Ink 14
    $px += $pw + 10
}
Draw-PrimaryBtn $g "Add to Chrome - Free" 100 430 300
Draw-PaperCard $g 860 80 460 400 18
Draw-Text $g "The outcome" (Get-Font "Segoe UI" 20 "Bold") $tb 890 125
Draw-Text $g "All your sources in one notebook" (Get-Font "Segoe UI" 14) $lb 890 170
Draw-Text $g "Ask questions across videos, pages," (Get-Font "Segoe UI" 14) $lb 890 200
Draw-Text $g "posts, and saved highlights." (Get-Font "Segoe UI" 14) $lb 890 228
Draw-PrimaryBtn $g "Start importing" 890 300 360
Save-RgbPng $c.Bitmap (Join-Path $outDir "promo-marquee-1400x560.png")
Dispose-Canvas $c
Write-Host "Created promo-marquee-1400x560.png"

if ($script:LogoImage) { $script:LogoImage.Dispose() }

@(
    "screenshot-01-workflow.png",
    "screenshot-03-popup.png",
    "screenshot-04-ai-chats.png",
    "screenshot-05-all-sources.png",
    "screenshot-01-hero.png",
    "screenshot-05-sources.png"
) | ForEach-Object {
    $old = Join-Path $outDir $_
    if (Test-Path $old) { Remove-Item $old -Force }
}

Write-Host "`nDone. Assets in $outDir"
