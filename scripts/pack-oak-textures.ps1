Add-Type -AssemblyName System.Drawing
$oakAssets = Join-Path (Get-Location) 'public/assets/maps/verdant-plains-v2/oak'
Get-ChildItem -LiteralPath $oakAssets -Filter '*.png' | ForEach-Object {
  $oakImage=[System.Drawing.Image]::FromFile($_.FullName)
  $oakBitmap=New-Object System.Drawing.Bitmap($oakImage.Width,$oakImage.Height,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $oakGraphics=[System.Drawing.Graphics]::FromImage($oakBitmap)
  $oakGraphics.DrawImage($oakImage,0,0,$oakImage.Width,$oakImage.Height)
  $oakGraphics.Dispose(); $oakImage.Dispose()
  if ($_.Name -eq 'bark-normal.png') {
    $oakEncoder=[System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
    $oakParams=New-Object System.Drawing.Imaging.EncoderParameters(1)
    $oakParams.Param[0]=New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality,95L)
    $oakBitmap.Save((Join-Path $oakAssets 'bark-normal.jpg'),$oakEncoder,$oakParams)
    $oakParams.Dispose()
  } else { $oakBitmap.Save($_.FullName,[System.Drawing.Imaging.ImageFormat]::Png) }
  $oakBitmap.Dispose()
}
Remove-Item -LiteralPath (Join-Path $oakAssets 'bark-normal.png')
