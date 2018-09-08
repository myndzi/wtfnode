#!/bin/bash -e

. ~/.nvm/nvm.sh

CURRENT_VERSION="$(node --version)"

declare -a versions=(
  "0.10"
  "0.12"
  "4"
  "5"
  "6"
  "7"
  "8"
  "9"
  "10"
)

test_version () {
  nvm install "$1" >/dev/null 2>/dev/null
  nvm use "$1"     >/dev/null
  npm test         >/dev/null
}

for ver in "${versions[@]}"; do
  if test_version "$ver"; then
    echo "$ver: ok"
  else
    echo "$ver: failed"
  fi
done

nvm use "$CURRENT_VERSION"
