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
# ═══ SANS-SERIF MODERNAS (Imprescindibles para UI y cuerpos legibles) ═══
  ["Inter-Regular"]="https://raw.githubusercontent.com/google/fonts/main/ofl/inter/static/Inter-Regular.ttf"
  ["Inter-Bold"]="https://raw.githubusercontent.com/google/fonts/main/ofl/inter/static/Inter-Bold.ttf"
  ["FiraSans-Regular"]="https://raw.githubusercontent.com/google/fonts/main/ofl/firasans/FiraSans-Regular.ttf"
  ["FiraSans-Bold"]="https://raw.githubusercontent.com/google/fonts/main/ofl/firasans/FiraSans-Bold.ttf"

  # ═══ ELEGANCIA Y TESTIMONIOS (Serifas modernas para citas y marcas premium) ═══
  ["PlayfairDisplay-Regular"]="https://raw.githubusercontent.com/google/fonts/main/ofl/playfairdisplay/static/PlayfairDisplay-Regular.ttf"
  ["PlayfairDisplay-Bold"]="https://raw.githubusercontent.com/google/fonts/main/ofl/playfairdisplay/static/PlayfairDisplay-Bold.ttf"
  ["Lora-Regular"]="https://raw.githubusercontent.com/google/fonts/main/ofl/lora/static/Lora-Regular.ttf"
  ["Lora-Bold"]="https://raw.githubusercontent.com/google/fonts/main/ofl/lora/static/Lora-Bold.ttf"
  ["Merriweather-Regular"]="https://raw.githubusercontent.com/google/fonts/main/ofl/merriweather/Merriweather-Regular.ttf"
  ["Merriweather-Bold"]="https://raw.githubusercontent.com/google/fonts/main/ofl/merriweather/Merriweather-Bold.ttf"

  # ═══ IMPACTO Y DATOS (Condensadas, ideales para números gigantes y Portadas) ═══
  ["Oswald-Regular"]="https://raw.githubusercontent.com/google/fonts/main/ofl/oswald/static/Oswald-Regular.ttf"
  ["Oswald-Bold"]="https://raw.githubusercontent.com/google/fonts/main/ofl/oswald/static/Oswald-Bold.ttf"
  ["Barlow-Regular"]="https://raw.githubusercontent.com/google/fonts/main/ofl/barlow/Barlow-Regular.ttf"
  ["Barlow-Bold"]="https://raw.githubusercontent.com/google/fonts/main/ofl/barlow/Barlow-Bold.ttf"

  # ═══ CERCANÍA Y BIENESTAR (Redondeadas, perfectas para pediatría o spa) ═══
  ["Quicksand-Regular"]="https://raw.githubusercontent.com/google/fonts/main/ofl/quicksand/static/Quicksand-Regular.ttf"
  ["Quicksand-Bold"]="https://raw.githubusercontent.com/google/fonts/main/ofl/quicksand/static/Quicksand-Bold.ttf"
  ["Rubik-Regular"]="https://raw.githubusercontent.com/google/fonts/main/ofl/rubik/static/Rubik-Regular.ttf"
  ["Rubik-Bold"]="https://raw.githubusercontent.com/google/fonts/main/ofl/rubik/static/Rubik-Bold.ttf"

  # ═══ ESTILO BOUTIQUE (Geométricas con mucho carácter) ═══
  ["JosefinSans-Regular"]="https://raw.githubusercontent.com/google/fonts/main/ofl/josefinsans/static/JosefinSans-Regular.ttf"
  ["JosefinSans-Bold"]="https://raw.githubusercontent.com/google/fonts/main/ofl/josefinsans/static/JosefinSans-Bold.ttf"
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
