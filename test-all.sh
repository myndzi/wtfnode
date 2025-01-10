#!/bin/bash -e

. ~/.nvm/nvm.sh

CURRENT_VERSION="$(node --version)"

declare -a versions=(
  "0.10.0"
  "0.10"
  "0.12.0"
  "0.12"
  "4.0.0"
  "4"
  "5.0.0"
  "5"
  "6.0.0"
  "6"
  "7.0.0"
  "7"
  "8.0.0"
  "8"
  "9.0.0"
  "9"
  "10.0.0"
  "10"
  "11.0.0"
  "11"
  "12.0.0"
  "12"
  "13.0.0"
  "13"
  "14.0.0"
  "14"
  "15.0.0"
  "15"
  "16.0.0"
  "16"
  "17.0.0"
  "17"
  "18.0.0"
  "18"
  "19.0.0"
  "19"
  "20.0.0"
  "20"
  "21.0.0"
  "21"
  "22.0.0"
  "22"
)

test_version () {
  nvm install "$1" >/dev/null 2>/dev/null
  nvm use "$1"     >/dev/null
  npm test         >/dev/null 2>/dev/null
}

for ver in "${versions[@]}"; do
  if test_version "$ver"; then
    echo "$ver: ok"
  else
    npm test
    echo "$ver: failed"
    break
  fi
done

nvm use "$CURRENT_VERSION"
