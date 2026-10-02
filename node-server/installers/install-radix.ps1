#!/usr/bin/env pwsh

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

param (
	[string]$TargetFolder = "."
)

$ErrorActionPreference = "Stop"

$VersionJsonUrl = "https://vault.ultraspark.net/radix/version.json"
$BaseUrl = "https://vault.ultraspark.net/radix/"
$TempZip = Join-Path $env:TEMP "website_download.zip"

try
{
	# Resolve target directory and create if non-existent.

	$ResolvedPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($TargetFolder)

	if (-not (Test-Path -Path $ResolvedPath))
	{
		New-Item -ItemType Directory -Path $ResolvedPath | Out-Null
	}

	Write-Host "Fetching version info..." -ForegroundColor Cyan
	$versionData = Invoke-RestMethod -Uri $VersionJsonUrl -Method Get

	# Parse InstallFile nested under Application.

	$fileName = $versionData.Application.InstallFile

	if (-not $fileName)
	{
		throw "Could not find Application.InstallFile in version.json"
	}

	# Combine base URL with relative filename.

	$ZipUrl = "$BaseUrl/$fileName"

	Write-Host "Downloading $fileName..." -ForegroundColor Cyan
	Invoke-WebRequest -Uri $ZipUrl -OutFile $TempZip

	Write-Host "Extracting to: $ResolvedPath" -ForegroundColor Cyan
	Expand-Archive -Path $TempZip -DestinationPath $ResolvedPath -Force

	Write-Host "Installation completed successfully!" -ForegroundColor Green
}
catch
{
	Write-Error "Installation failed: $_"
}
finally
{
	if (Test-Path -Path $TempZip) 
	{
		Remove-Item -Path $TempZip -Force -ErrorAction SilentlyContinue
	}
}