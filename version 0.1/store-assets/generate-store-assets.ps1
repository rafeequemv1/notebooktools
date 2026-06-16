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

# --- Screenshot 1: Workflow overview ---
$c = New-Bitmap 1280 800
$g = $c.Graphics
Draw-RainbowBar $g 0 0 1280 5
Draw-BrandHeader $g 72 52 48
$ey = Get-Font "Segoe UI" 13 "Bold"
$eb = New-Object System.Drawing.SolidBrush $script:Accent
Draw-Text $g "WORKFLOW" $ey $eb 72 130
$title = Get-Font "Segoe UI" 40 "Bold"
$tb = New-Object System.Drawing.SolidBrush $script:Ink
Draw-Text $g "From the web to NotebookLM in 3 steps" $title $tb 72 158
$lead = Get-Font "Segoe UI" 18
$lb = New-Object System.Drawing.SolidBrush $script:Muted
Draw-Text $g "Pick a source, choose a notebook, import. Your session, your data." $lead $lb 72 220

Draw-Step $g 1 72 290 "Install extension" "Add NotebookTools to Chrome"
Draw-Arrow $g 300 345 340 345
Draw-Step $g 2 350 290 "Open a source" "YouTube, ChatGPT, Gemini, X, or any page"
Draw-Arrow $g 578 345 618 345
Draw-Step $g 3 628 290 "Click import" "Source appears in NotebookLM"

Draw-PaperCard $g 72 440 1136 300 18
Draw-Text $g "Supported sources" (Get-Font "Segoe UI" 14 "Bold") $lb 100 468
$px = 100; $py = 510
foreach ($p in @("YouTube", "ChatGPT", "Gemini", "X", "Webpage", "Highlight")) {
    $pw = Draw-Pill $g $p $px $py ([System.Drawing.Color]::FromArgb(246, 242, 234)) $script:Ink
    $px += $pw + 12
}
Draw-Arrow $g 700 525 780 525
Draw-Logo $g 790 498 56
Draw-Arrow $g 860 525 940 525
Draw-PaperCard $g 950 478 220 96 12
Draw-Text $g "NotebookLM" (Get-Font "Segoe UI" 16 "Bold") $tb 1000 500
Draw-Text $g "Your notebook" (Get-Font "Segoe UI" 12) $lb 1000 530
Save-RgbPng $c.Bitmap (Join-Path $outDir "screenshot-01-workflow.png")
Dispose-Canvas $c
Write-Host "Created screenshot-01-workflow.png"

# --- Screenshot 2: YouTube ---
$c = New-Bitmap 1280 800
$g = $c.Graphics
Draw-RainbowBar $g 0 0 1280 5
Draw-BrandHeader $g 72 40 40
Draw-Text $g "YouTube import" (Get-Font "Segoe UI" 34 "Bold") $tb 72 110
Draw-Text $g "Step 1: Open a video  |  Step 2: Click NotebookLM  |  Step 3: Pick notebook" (Get-Font "Segoe UI" 16) $lb 72 165

Draw-PaperCard $g 72 210 1136 520 18
$yt = New-Object System.Drawing.SolidBrush $script:YouTube
$g.FillRectangle($yt, 100, 240, 1140, 48)
Draw-Text $g "youtube.com" (Get-Font "Segoe UI" 18 "Bold") (New-Object System.Drawing.SolidBrush $script:Paper) 120 252
$dark = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(18, 18, 18))
Fill-RoundRect $g $dark 120 310 1080 380 10
$play = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(50, 50, 50))
Fill-RoundRect $g $play 580 430 120 80 8
Draw-Text $g ">" (Get-Font "Segoe UI" 36 "Bold") (New-Object System.Drawing.SolidBrush $script:Paper) 625 445

# highlight button
Draw-PaperCard $g 900 248 280 52 26
Draw-Logo $g 912 254 40
Draw-Text $g "NotebookLM" (Get-Font "Segoe UI" 15 "Bold") $tb 960 264
$hl = New-Object System.Drawing.Pen $script:Accent, 3
Draw-RoundRect $g $hl 896 244 288 60 26
$hl.Dispose()

Draw-PaperCard $g 420 620 440 80 12
Draw-Text $g "One click on every watch page" (Get-Font "Segoe UI" 20 "Bold") $tb 450 648
Save-RgbPng $c.Bitmap (Join-Path $outDir "screenshot-02-youtube.png")
Dispose-Canvas $c
Write-Host "Created screenshot-02-youtube.png"

# --- Screenshot 3: Popup ---
$c = New-Bitmap 1280 800
$g = $c.Graphics
Draw-RainbowBar $g 0 0 1280 5
Draw-BrandHeader $g 72 40 40
Draw-Text $g "Webpage import from popup" (Get-Font "Segoe UI" 34 "Bold") $tb 72 110
Draw-Text $g "Open extension on any tab, select notebook, import URL" (Get-Font "Segoe UI" 16) $lb 72 165

Draw-PaperCard $g 380 200 520 480 18
Draw-Logo $g 410 230 40
Draw-Text $g "NotebookTools" (Get-Font "Segoe UI" 18 "Bold") $tb 460 240
Draw-PrimaryBtn $g "Webpage" 410 290 100
Fill-RoundRect $g (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(246, 242, 234))) 520 290 90 44 8
Draw-Text $g "YouTube" (Get-Font "Segoe UI" 13) $lb 538 302
Draw-Text $g "1. Current page URL" (Get-Font "Segoe UI" 12 "Bold") $lb 410 360
Fill-RoundRect $g (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(253, 251, 247))) 410 382 460 40 8
Draw-Text $g "https://article-you-are-reading.com" (Get-Font "Segoe UI" 13) $tb 424 392
Draw-Text $g "2. Choose notebook" (Get-Font "Segoe UI" 12 "Bold") $lb 410 440
Fill-RoundRect $g (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(253, 251, 247))) 410 462 460 40 8
Draw-Text $g "Research notes" (Get-Font "Segoe UI" 13) $tb 424 472
Draw-Text $g "3. Import" (Get-Font "Segoe UI" 12 "Bold") $lb 410 520
Draw-PrimaryBtn $g "Import webpage" 410 548 460

Draw-Step $g 1 72 300 "Pin extension" "Click toolbar icon on any tab"
Draw-Step $g 2 72 430 "Select notebook" "Create new or use existing"
Save-RgbPng $c.Bitmap (Join-Path $outDir "screenshot-03-popup.png")
Dispose-Canvas $c
Write-Host "Created screenshot-03-popup.png"

# --- Screenshot 4: AI chats ---
$c = New-Bitmap 1280 800
$g = $c.Graphics
Draw-RainbowBar $g 0 0 1280 5
Draw-BrandHeader $g 72 40 40
Draw-Text $g "ChatGPT and Gemini" (Get-Font "Segoe UI" 34 "Bold") $tb 72 110
Draw-Text $g "Full conversation extracted and sent as a text source" (Get-Font "Segoe UI" 16) $lb 72 165

Draw-PaperCard $g 72 210 700 520 18
Draw-PrimaryBtn $g "NotebookLM" 100 240 200
Draw-Logo $g 108 248 28
Draw-Text $g "Chat thread" (Get-Font "Segoe UI" 13 "Bold") $lb 100 310
Fill-RoundRect $g (New-Object System.Drawing.SolidBrush $script:Accent) 100 340 480 48 10
Draw-Text $g "Summarize my research sources" (Get-Font "Segoe UI" 14) (New-Object System.Drawing.SolidBrush $script:Paper) 118 356
Fill-RoundRect $g (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(253, 251, 247))) 100 410 580 140 10
Draw-Text $g "Here is a synthesis across your videos, articles," (Get-Font "Segoe UI" 14) $tb 118 430
Draw-Text $g "and chat notes in NotebookLM..." (Get-Font "Segoe UI" 14) $tb 118 458

Draw-PaperCard $g 820 280 388 380 18
Draw-Logo $g 850 310 64
Draw-Text $g "Import flow" (Get-Font "Segoe UI" 18 "Bold") $tb 930 320
Draw-Text $g "1. Button at top of chat" (Get-Font "Segoe UI" 13) $lb 850 380
Draw-Text $g "2. Extract full conversation" (Get-Font "Segoe UI" 13) $lb 850 410
Draw-Text $g "3. Add to notebook as text" (Get-Font "Segoe UI" 13) $lb 850 440
Draw-Arrow $g 900 500 900 560
Draw-PaperCard $g 850 570 320 56 10
Draw-Text $g "NotebookLM source added" (Get-Font "Segoe UI" 14 "Bold") $tb 900 588
Save-RgbPng $c.Bitmap (Join-Path $outDir "screenshot-04-ai-chats.png")
Dispose-Canvas $c
Write-Host "Created screenshot-04-ai-chats.png"

# --- Screenshot 5: Highlight + all sources ---
$c = New-Bitmap 1280 800
$g = $c.Graphics
Draw-RainbowBar $g 0 0 1280 5
Draw-BrandHeader $g 72 40 40
Draw-Text $g "Right-click highlights and more" (Get-Font "Segoe UI" 34 "Bold") $tb 72 110
Draw-Text $g "X threads, selected text, and every import path in one extension" (Get-Font "Segoe UI" 16) $lb 72 165

Draw-PaperCard $g 72 220 540 420 18
Draw-Text $g "Any webpage" (Get-Font "Segoe UI" 14 "Bold") $lb 100 250
Fill-RoundRect $g (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(253, 251, 247))) 100 280 500 120 8
Draw-Text $g "Highlight important text on any site..." (Get-Font "Segoe UI" 15) $tb 120 310
$hlBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 249, 196))
$g.FillRectangle($hlBrush, 120, 340, 340, 28)
Draw-Text $g "key insight you want in NotebookLM" (Get-Font "Segoe UI" 14 "Bold") $tb 128 346
$hlBrush.Dispose()

Draw-PaperCard $g 100 430 280 180 10
Draw-Text $g "Add to NotebookLM" (Get-Font "Segoe UI" 14 "Bold") $tb 130 460
Draw-Text $g "Copy" (Get-Font "Segoe UI" 12) $lb 130 500
Draw-Text $g "Search Google for..." (Get-Font "Segoe UI" 12) $lb 130 530

Draw-PaperCard $g 660 220 548 520 18
Draw-Text $g "All import paths" (Get-Font "Segoe UI" 18 "Bold") $tb 690 250
$iy = 300
foreach ($row in @(
    @{ I = "YouTube"; D = "Watch page button" },
    @{ I = "ChatGPT / Gemini"; D = "In-page chat button" },
    @{ I = "X / Twitter"; D = "Threads and articles" },
    @{ I = "Webpage"; D = "Popup URL import" },
    @{ I = "Selected text"; D = "Right-click menu" }
)) {
    Fill-RoundRect $g (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(253, 251, 247))) 690 $iy 488 56 8
    Draw-Logo $g 704 ($iy + 8) 40
    Draw-Text $g $row.I (Get-Font "Segoe UI" 14 "Bold") $tb 756 ($iy + 10)
    Draw-Text $g $row.D (Get-Font "Segoe UI" 12) $lb 756 ($iy + 32)
    $iy += 68
}
Save-RgbPng $c.Bitmap (Join-Path $outDir "screenshot-05-all-sources.png")
Dispose-Canvas $c
Write-Host "Created screenshot-05-all-sources.png"

# --- Small promo 440x280 ---
$c = New-Bitmap 440 280
$g = $c.Graphics
Draw-RainbowBar $g 0 0 440 5
Draw-Logo $g 32 36 72
Draw-Text $g "NotebookTools" (Get-Font "Segoe UI" 24 "Bold") $tb 118 58
Draw-Text $g "Import to NotebookLM" (Get-Font "Segoe UI" 15) $lb 32 130
$px = 32; $py = 168
foreach ($p in @("YouTube", "ChatGPT", "Web")) {
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
Draw-Text $g "Import YouTube, AI chats, X, webpages, and highlights into NotebookLM" (Get-Font "Segoe UI" 24) $tb 100 230
Draw-Text $g "Free Chrome extension  |  One click  |  Your Google sign-in" (Get-Font "Segoe UI" 17) $lb 100 285
$px = 100; $py = 350
foreach ($p in @("YouTube", "ChatGPT", "Gemini", "X", "Web", "Text")) {
    $pw = Draw-Pill $g $p $px $py ([System.Drawing.Color]::FromArgb(246, 242, 234)) $script:Ink 14
    $px += $pw + 10
}
Draw-PrimaryBtn $g "Add to Chrome - Free" 100 430 300

Draw-PaperCard $g 860 80 460 400 18
Draw-Logo $g 890 110 56
Draw-Text $g "How it works" (Get-Font "Segoe UI" 20 "Bold") $tb 960 125
Draw-Text $g "1. Install and sign in to NotebookLM" (Get-Font "Segoe UI" 14) $lb 890 190
Draw-Text $g "2. Click import on any supported site" (Get-Font "Segoe UI" 14) $lb 890 230
Draw-Text $g "3. Source appears in your notebook" (Get-Font "Segoe UI" 14) $lb 890 270
Draw-PrimaryBtn $g "Import now" 890 340 360
Save-RgbPng $c.Bitmap (Join-Path $outDir "promo-marquee-1400x560.png")
Dispose-Canvas $c
Write-Host "Created promo-marquee-1400x560.png"

if ($script:LogoImage) { $script:LogoImage.Dispose() }

# Remove old filenames if present
@(
    "screenshot-01-hero.png",
    "screenshot-05-sources.png"
) | ForEach-Object {
    $old = Join-Path $outDir $_
    if (Test-Path $old) { Remove-Item $old -Force }
}

Write-Host "`nDone. Assets in $outDir"
