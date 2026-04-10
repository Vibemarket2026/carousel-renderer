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
# ═══ SANS-SERIF CORE (Las que ya tenías) ═══
  ["Roboto-Regular"]="https://fonts.gstatic.com/s/roboto/v30/KFOMCnqEu92Fr1Mu4mxK.ttf"
  ["Roboto-Bold"]="https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlfBBc4.ttf"
  ["Montserrat-Regular"]="https://fonts.gstatic.com/s/montserrat/v26/JTUSjIg1_i6t8kCHKm459Wlhzg.ttf"
  ["Montserrat-Bold"]="https://fonts.gstatic.com/s/montserrat/v26/JTURjIg1_i6t8kCHKm45_dJE3gnD_g.ttf"
  ["Poppins-Regular"]="https://fonts.gstatic.com/s/poppins/v21/pxiEyp8kv8JHgFVrJJfecg.ttf"
  ["Poppins-Bold"]="https://fonts.gstatic.com/s/poppins/v21/pxiByp8kv8JHgFVrLCz7Z1xlFQ.ttf"
  ["OpenSans-Regular"]="https://fonts.gstatic.com/s/opensans/v36/memSYaGs126MiZpBA-UvWbX2vVnXBbObj2OVZyOOSr4dVJWUgsjZ0B4t.ttf"
  ["OpenSans-Bold"]="https://fonts.gstatic.com/s/opensans/v36/memSYaGs126MiZpBA-UvWbX2vVnXBbObj2OVZyOOSr4dVJWUgsgH1x4t.ttf"
  ["Lato-Regular"]="https://fonts.gstatic.com/s/lato/v24/S6uyw4BMUTPHjx4wXg.ttf"
  ["Lato-Bold"]="https://fonts.gstatic.com/s/lato/v24/S6u9w4BMUTPHh6UVSwiPHA.ttf"
  ["Raleway-Regular"]="https://fonts.gstatic.com/s/raleway/v29/1Ptug8zYS_SKggPNyC0IT4ttDfA.ttf"
  ["Raleway-Bold"]="https://fonts.gstatic.com/s/raleway/v29/1Ptrg8zYS_SKggPNwIYqWqZPBQ.ttf"
  ["Nunito-Regular"]="https://fonts.gstatic.com/s/nunito/v26/XRXV3I6Li01BKofINeaB.ttf"
  ["Nunito-Bold"]="https://fonts.gstatic.com/s/nunito/v26/XRXW3I6Li01BKofA6sKUYevN.ttf"
  ["WorkSans-Regular"]="https://fonts.gstatic.com/s/worksans/v19/QGY_z_wNahGAdqQ43RhVcIgYT2Xz5u32K0nXNigDp6_cOyA.ttf"
  ["WorkSans-Bold"]="https://fonts.gstatic.com/s/worksans/v19/QGY_z_wNahGAdqQ43RhVcIgYT2Xz5u32K5fQNigDp6_cOyA.ttf"
  ["DMSans-Regular"]="https://fonts.gstatic.com/s/dmsans/v15/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwAkpFhRQ.ttf"
  ["DMSans-Bold"]="https://fonts.gstatic.com/s/dmsans/v15/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwA-JZhRQ.ttf"

  # ═══ SANS-SERIF MODERNAS (Adiciones) ═══
  ["Inter-Regular"]="https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZJhjp-Ek-_EeA.ttf"
  ["Inter-Bold"]="https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFuYAZJhjp-Ek-_EeA.ttf"
  ["FiraSans-Regular"]="https://fonts.gstatic.com/s/firasans/v17/va9E4kDNxMZdWfMOD5Vvl4jO.ttf"
  ["FiraSans-Bold"]="https://fonts.gstatic.com/s/firasans/v17/va9B4kDNxMZdWfMOD5VnPKreSxf6.ttf"

  # ═══ ELEGANCIA Y TESTIMONIOS (Serifas) ═══
  ["PlayfairDisplay-Regular"]="https://fonts.gstatic.com/s/playfairdisplay/v30/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWbn2PKwuvg.ttf"
  ["PlayfairDisplay-Bold"]="https://fonts.gstatic.com/s/playfairdisplay/v30/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWbn2PEOuvg.ttf"
  ["Lora-Regular"]="https://fonts.gstatic.com/s/lora/v35/0QI6MX1D_JOuGQbT0gvTJPa787weuxBM.ttf"
  ["Lora-Bold"]="https://fonts.gstatic.com/s/lora/v35/0QI6MX1D_JOuGQbT0gvTJPa787z5vBBM.ttf"
  ["Merriweather-Regular"]="https://fonts.gstatic.com/s/merriweather/v30/u-440qyriQwlOrhSvowK_l5-fCZM.ttf"
  ["Merriweather-Bold"]="https://fonts.gstatic.com/s/merriweather/v30/u-4n0qyriQwlOrhSvowK_l52xwNZWMf6.ttf"

  # ═══ IMPACTO Y DATOS (Condensadas) ═══
  ["Oswald-Regular"]="https://fonts.gstatic.com/s/oswald/v53/TK3_WkUHHAIjg75cFRf3bXL8LICs1_FvsUtiZTaR.ttf"
  ["Oswald-Bold"]="https://fonts.gstatic.com/s/oswald/v53/TK3_WkUHHAIjg75cFRf3bXL8LICs1_FvsUtiZTaR.ttf" # Oswald usa weights variables, este enlace suele servir el pack.
  ["Barlow-Regular"]="https://fonts.gstatic.com/s/barlow/v12/7cHpv4kjgoGqM7E_DMs5.ttf"
  ["Barlow-Bold"]="https://fonts.gstatic.com/s/barlow/v12/7cHqv4kjgoGqM7E3t-4kN4Q.ttf"

  # ═══ CERCANÍA Y BIENESTAR (Redondeadas) ═══
  ["Quicksand-Regular"]="https://fonts.gstatic.com/s/quicksand/v31/6xK-dSZaM9iE8KbpRA_LJ3z8mH9BOJvgkP8o58m-xjs.ttf"
  ["Quicksand-Bold"]="https://fonts.gstatic.com/s/quicksand/v31/6xK-dSZaM9iE8KbpRA_LJ3z8mH9BOJvgkP8o58m-xjs.ttf" # Igual que Oswald, enlace variable.
  ["Rubik-Regular"]="https://fonts.gstatic.com/s/rubik/v28/iJWZBXyIfDnIV5PNhY1KTN7Z-Yh-WYi1WE8VAQ.ttf"
  ["Rubik-Bold"]="https://fonts.gstatic.com/s/rubik/v28/iJWZBXyIfDnIV5PNhY1KTN7Z-Yh-WYi1WE8VAQ.ttf" # Enlace variable.

  # ═══ ESTILO BOUTIQUE (Geométricas) ═══
  ["JosefinSans-Regular"]="https://fonts.gstatic.com/s/josefinsans/v32/Qw3PZQNVED7rKGKxtqIqX5E-AVSJrOCfjY46_Nj_MA.ttf"
  ["JosefinSans-Bold"]="https://fonts.gstatic.com/s/josefinsans/v32/Qw3PZQNVED7rKGKxtqIqX5E-AVSJrOCfjY46_Nj_MA.ttf" # Enlace variable.
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
