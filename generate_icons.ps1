Add-Type -AssemblyName System.Drawing

$sourcePath = Join-Path $PSScriptRoot "icon.png"
if (-not (Test-Path $sourcePath)) {
    Write-Error "icon.png not found!"
    exit 1
}

$srcImg = [System.Drawing.Image]::FromFile($sourcePath)

function Resize-Image {
    param (
        [System.Drawing.Image]$Image,
        [int]$Width,
        [int]$Height,
        [string]$OutputPath
    )
    
    $dir = [System.IO.Path]::GetDirectoryName($OutputPath)
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }

    $bmp = New-Object System.Drawing.Bitmap($Width, $Height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    
    $g.DrawImage($Image, 0, 0, $Width, $Height)
    $g.Dispose()
    
    $bmp.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Generated: $OutputPath ($Width x $Height)"
}

# 1. Generate Android Mipmaps
$androidRes = Join-Path $PSScriptRoot "android\app\src\main\res"

$sizes = @{
    "mipmap-mdpi" = 48
    "mipmap-hdpi" = 72
    "mipmap-xhdpi" = 96
    "mipmap-xxhdpi" = 144
    "mipmap-xxxhdpi" = 192
}

foreach ($folder in $sizes.Keys) {
    $sz = $sizes[$folder]
    $folderPath = Join-Path $androidRes $folder
    Resize-Image -Image $srcImg -Width $sz -Height $sz -OutputPath (Join-Path $folderPath "ic_launcher.png")
    Resize-Image -Image $srcImg -Width $sz -Height $sz -OutputPath (Join-Path $folderPath "ic_launcher_round.png")
    Resize-Image -Image $srcImg -Width ($sz * 2) -Height ($sz * 2) -OutputPath (Join-Path $folderPath "ic_launcher_foreground.png")
}

# 2. Generate Build Folder Icons for Electron (Windows & Mac)
$buildDir = Join-Path $PSScriptRoot "build"
Resize-Image -Image $srcImg -Width 1024 -Height 1024 -OutputPath (Join-Path $buildDir "icon.png")
Resize-Image -Image $srcImg -Width 512 -Height 512 -OutputPath (Join-Path $buildDir "512x512.png")

$srcImg.Dispose()
Write-Host "All icons generated successfully!"
