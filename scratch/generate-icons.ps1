Add-Type -AssemblyName System.Drawing

function Generate-TradeFlowIcon([int]$size, [string]$outPath) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    $navy = [System.Drawing.ColorTranslator]::FromHtml('#12304A')
    $green = [System.Drawing.ColorTranslator]::FromHtml('#20A66A')
    $navyBrush = New-Object System.Drawing.SolidBrush($navy)
    $greenBrush = New-Object System.Drawing.SolidBrush($green)

    # Draw rounded rect for background
    $radius = [float]($size * 0.22)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $dia = [float]($radius * 2.0)
    $rect = New-Object System.Drawing.RectangleF(0, 0, [float]$size, [float]$size)

    $path.AddArc($rect.X, $rect.Y, $dia, $dia, 180, 90)
    $path.AddArc($rect.Right - $dia, $rect.Y, $dia, $dia, 270, 90)
    $path.AddArc($rect.Right - $dia, $rect.Bottom - $dia, $dia, $dia, 0, 90)
    $path.AddArc($rect.X, $rect.Bottom - $dia, $dia, $dia, 90, 90)
    $path.CloseFigure()

    $g.FillPath($navyBrush, $path)

    # Scale factor from 512 canvas
    $scale = [float]($size / 512.0)

    # Top bar: x=120, y=144, w=272, h=64, r=16
    # Stem: x=216, y=208, w=80, h=160, r=16
    $tRad = [float]([Math]::Max(2.0, 16.0 * $scale))
    
    function Add-RoundedRect($gp, [float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
        $d = [float]($r * 2.0)
        $gp.AddArc($x, $y, $d, $d, 180, 90)
        $gp.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
        $gp.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
        $gp.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
        $gp.CloseFigure()
    }

    $topBarPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    Add-RoundedRect $topBarPath (120.0 * $scale) (144.0 * $scale) (272.0 * $scale) (64.0 * $scale) $tRad
    $g.FillPath($greenBrush, $topBarPath)

    # Stem path with seamless overlap
    $stemPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    Add-RoundedRect $stemPath (216.0 * $scale) ((144.0 + 64.0 - 16.0) * $scale) (80.0 * $scale) ((160.0 + 16.0) * $scale) $tRad
    $g.FillPath($greenBrush, $stemPath)

    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Generated: $outPath ($size x $size)"
}

$dirs = @(
    "c:\Users\ASUS\Desktop\wholesaller-updated\retailer-portel\public",
    "c:\Users\ASUS\Desktop\wholesaller-updated\admin\public",
    "c:\Users\ASUS\Desktop\wholesaller-updated\wholeSeller\public"
)

foreach ($dir in $dirs) {
    Generate-TradeFlowIcon 32 (Join-Path $dir "favicon-32x32.png")
    Generate-TradeFlowIcon 180 (Join-Path $dir "apple-touch-icon.png")
    Generate-TradeFlowIcon 512 (Join-Path $dir "favicon-512x512.png")
}
