#!/bin/bash
# download-fonts.sh
# Downloads all supported Google Fonts for the render engine
# Run once after cloning the repo, then commit the fonts/ directory

FONTS_DIR="./fonts"
mkdir -p "$FONTS_DIR"

# Google Fonts direct download URLs (from fonts.google.com API)
# Each font family needs Regular (400) and Bold (700)

declare -A FONTS=(
  # Already included: Inter
  ["Roboto-Regular"]="https://fonts.gstatic.com/s/roboto/v47/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWubEbGmT.ttf"
  ["Roboto-Bold"]="https://fonts.gstatic.com/s/roboto/v47/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWuaabWmT.ttf"
  ["Montserrat-Regular"]="https://fonts.gstatic.com/s/montserrat/v29/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Hw5aXo.ttf"
  ["Montserrat-Bold"]="https://fonts.gstatic.com/s/montserrat/v29/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCuM73w5aXo.ttf"
  ["Poppins-Regular"]="https://fonts.gstatic.com/s/poppins/v22/pxiEyp8kv8JHgFVrFJA.ttf"
  ["Poppins-Bold"]="https://fonts.gstatic.com/s/poppins/v22/pxiByp8kv8JHgFVrLCz7V1s.ttf"
  ["OpenSans-Regular"]="https://fonts.gstatic.com/s/opensans/v40/memSYaGs126MiZpBA-UvWbX2vVnXBbObj2OVZyOOSr4dVJWUgsjZ0C4nY.ttf"
  ["OpenSans-Bold"]="https://fonts.gstatic.com/s/opensans/v40/memSYaGs126MiZpBA-UvWbX2vVnXBbObj2OVZyOOSr4dVJWUgsg-1C4nY.ttf"
  ["Lato-Regular"]="https://fonts.gstatic.com/s/lato/v24/S6uyw4BMUTPHvxk.ttf"
  ["Lato-Bold"]="https://fonts.gstatic.com/s/lato/v24/S6u9w4BMUTPHh6UVew8.ttf"
  ["Raleway-Regular"]="https://fonts.gstatic.com/s/raleway/v34/1Ptxg8zYS_SKggPNyC0IT4ttDfA.ttf"
  ["Raleway-Bold"]="https://fonts.gstatic.com/s/raleway/v34/1Ptxg8zYS_SKggPNyCIIT4ttDfCbLA.ttf"
  ["Nunito-Regular"]="https://fonts.gstatic.com/s/nunito/v26/XRXI3I6Li01BKofiOc5wtlZ2di8HDLshRTY9jo7eTWk.ttf"
  ["Nunito-Bold"]="https://fonts.gstatic.com/s/nunito/v26/XRXI3I6Li01BKofiOc5wtlZ2di8HDOUuRTY9jo7eTWk.ttf"
  ["WorkSans-Regular"]="https://fonts.gstatic.com/s/worksans/v19/QGY_z_wNahGAdqQ43RhVcIgYT2Xz5u32K0nXNigDp6_cOyA.ttf"
  ["WorkSans-Bold"]="https://fonts.gstatic.com/s/worksans/v19/QGY_z_wNahGAdqQ43RhVcIgYT2Xz5u32K5fQNigDp6_cOyA.ttf"
  ["DMSans-Regular"]="https://fonts.gstatic.com/s/dmsans/v15/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwAkpFhRQ.ttf"
  ["DMSans-Bold"]="https://fonts.gstatic.com/s/dmsans/v15/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwA-JZhRQ.ttf"
)

echo "Downloading fonts to $FONTS_DIR..."
echo ""

for font_name in "${!FONTS[@]}"; do
  url="${FONTS[$font_name]}"
  output="$FONTS_DIR/${font_name}.ttf"
  
  if [ -f "$output" ]; then
    echo "  ✓ $font_name.ttf (already exists)"
  else
    echo "  ↓ Downloading $font_name.ttf..."
    curl -sL "$url" -o "$output"
    if [ $? -eq 0 ] && [ -s "$output" ]; then
      echo "  ✓ $font_name.ttf downloaded"
    else
      echo "  ✗ Failed to download $font_name.ttf"
      rm -f "$output"
    fi
  fi
done

echo ""
echo "NOTE: Playfair Display, Merriweather, Source Sans Pro, Outfit, and"
echo "Plus Jakarta Sans need to be downloaded manually from fonts.google.com"
echo "because their URLs change frequently."
echo ""
echo "Download from: https://fonts.google.com"
echo "Place -Regular.ttf and -Bold.ttf in the fonts/ directory."
echo ""
echo "Font files in $FONTS_DIR:"
ls -la "$FONTS_DIR"/*.ttf 2>/dev/null | wc -l
echo " font files found"
