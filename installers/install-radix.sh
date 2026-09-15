#!/usr/bin/env bash

#**************************************************************************************************
# RadixCMS Installer
#
# DESCRIPTION:
# This script downloads and installs the latest version of RadixCMS from the official
# Ultra Spark Software repository.
#
# Copyright (C) 2026 Ultra Spark Software <salve@ultraspark.net>
# SPDX-License-Identifier: GPL-3.0-or-later
#*************************************************************************************************/

set -euo pipefail

VERSION_JSON_URL="https://vault.ultraspark.net/radix/version.json"
BASE_URL="https://vault.ultraspark.net/radix"
TARGET_DIR="${1:-.}"
TEMP_ZIP=$(mktemp --suffix=.zip)

# Cleanup temporary archive on exit.
trap 'rm -f "$TEMP_ZIP"' EXIT

# Verify dependencies.

for cmd in curl unzip jq; do
	if ! command -v "$cmd" &> /dev/null; then
		echo "Error: Required command '$cmd' is not installed." >&2
		exit 1
	fi
done

# Ensure target folder exists.
mkdir -p "$TARGET_DIR"

echo "Fetching version info..."

# Parse Application.InstallFile using jq.
ZIP_FILENAME=$(curl -sSL "$VERSION_JSON_URL" | jq -r '.Application.InstallFile')

if [[ -z "$ZIP_FILENAME" || "$ZIP_FILENAME" == "null" ]]; then
	echo "Error: Could not extract Application.InstallFile from version.json" >&2
	exit 1
fi

ZIP_URL="${BASE_URL}/${ZIP_FILENAME}"

echo "Downloading ${ZIP_FILENAME}..."
curl -sSL -o "$TEMP_ZIP" "$ZIP_URL"

echo "Extracting to: $TARGET_DIR"
unzip -q -o "$TEMP_ZIP" -d "$TARGET_DIR"

echo "Installation completed successfully!"