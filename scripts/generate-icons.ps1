param(
  [string]$OutputDirectory = (Join-Path $PSScriptRoot "..\icons")
)

$ErrorActionPreference = "Stop"
$drawingAssembly = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\System.Drawing.dll"
Add-Type -Path $drawingAssembly

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

function New-RoundedPath([System.Drawing.Rectangle]$Rectangle, [int]$Radius) {
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $diameter = $Radius * 2
  $path.AddArc($Rectangle.X, $Rectangle.Y, $diameter, $diameter, 180, 90)
  $path.AddArc($Rectangle.Right - $diameter, $Rectangle.Y, $diameter, $diameter, 270, 90)
  $path.AddArc($Rectangle.Right - $diameter, $Rectangle.Bottom - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($Rectangle.X, $Rectangle.Bottom - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function New-ToolboxIcon([int]$Size, [string]$Path) {
  $baseSize = 128
  $scale = 8
  $canvasSize = $baseSize * $scale
  $bitmap = [System.Drawing.Bitmap]::new($canvasSize, $canvasSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.Clear([System.Drawing.Color]::FromArgb(17, 17, 19))

  $outer = [System.Drawing.Rectangle]::new((2 * $scale), (2 * $scale), ($canvasSize - (4 * $scale)), ($canvasSize - (4 * $scale)))
  $outerPath = New-RoundedPath $outer (24 * $scale)
  $outerBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new($outer, [System.Drawing.Color]::FromArgb(22, 22, 29), [System.Drawing.Color]::FromArgb(64, 57, 92), 135)
  $graphics.FillPath($outerBrush, $outerPath)
  $outerPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(70, 255, 255, 255), (1.5 * $scale))
  $graphics.DrawPath($outerPen, $outerPath)

  $shield = [System.Drawing.Point[]]@(
    ([System.Drawing.Point]::new((64 * $scale), (20 * $scale))),
    ([System.Drawing.Point]::new((96 * $scale), (34 * $scale))),
    ([System.Drawing.Point]::new((91 * $scale), (66 * $scale))),
    ([System.Drawing.Point]::new((64 * $scale), (101 * $scale))),
    ([System.Drawing.Point]::new((37 * $scale), (66 * $scale))),
    ([System.Drawing.Point]::new((32 * $scale), (34 * $scale)))
  )
  $shieldBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(177, 241, 181))
  $shieldPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(244, 255, 244), (2.2 * $scale))
  $graphics.FillPolygon($shieldBrush, $shield)
  $graphics.DrawPolygon($shieldPen, $shield)

  $keyBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(25, 58, 35))
  $keyCircle = [System.Drawing.Rectangle]::new((54 * $scale), (42 * $scale), (20 * $scale), (20 * $scale))
  $graphics.FillEllipse($keyBrush, $keyCircle)
  $graphics.FillRectangle($keyBrush, (58 * $scale), (56 * $scale), (12 * $scale), (23 * $scale))
  $checkPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 255, 255), (3.2 * $scale))
  $graphics.DrawLines($checkPen, [System.Drawing.Point[]]@(
    ([System.Drawing.Point]::new((49 * $scale), (80 * $scale))),
    ([System.Drawing.Point]::new((59 * $scale), (89 * $scale))),
    ([System.Drawing.Point]::new((79 * $scale), (69 * $scale)))
  ))

  $small = [System.Drawing.Bitmap]::new($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $smallGraphics = [System.Drawing.Graphics]::FromImage($small)
  $smallGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $smallGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $smallGraphics.DrawImage($bitmap, 0, 0, $Size, $Size)
  $small.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)

  $smallGraphics.Dispose()
  $small.Dispose()
  $keyBrush.Dispose()
  $shieldPen.Dispose()
  $shieldBrush.Dispose()
  $outerPen.Dispose()
  $outerBrush.Dispose()
  $outerPath.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

foreach ($size in @(16, 32, 48, 128)) {
  New-ToolboxIcon $size (Join-Path $OutputDirectory "icon$size.png")
}

Write-Output "Generated icons in $OutputDirectory"
