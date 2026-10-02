# lcd
# Version 1.0.0
# August 27, 2025
#
# SUMMARY:
# Changes the current directory (UNC) to the local path.
# Tested with Visual Studio Code's "Open in Integrated Terminal" function.
#
# REQUIREMENTS:
# PowerShell 5.x or higher

cd ((Get-Location) -replace '.*?c\$', 'C:')