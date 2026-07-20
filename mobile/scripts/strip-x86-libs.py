#!/usr/bin/env python3
"""Strip x86/x86_64 native libraries from an Android APK, then optionally re-sign."""
import zipfile, os, sys, subprocess, shutil

APK = sys.argv[1] if len(sys.argv) > 1 else 'android/app/build/outputs/apk/release/app-release.apk'

# Read listing
z = zipfile.ZipFile(APK, 'r')
all_files = z.namelist()
stripped = [f for f in all_files if not f.startswith('lib/x86/') and not f.startswith('lib/x86_64/')]
removed = len(all_files) - len(stripped)
z.close()

if removed == 0:
    print('No x86/x86_64 libs to strip.')
    sys.exit(0)

# Write stripped APK to temp file, then replace
tmp = APK + '.tmp'
zin = zipfile.ZipFile(APK, 'r')
zout = zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED)
for f in stripped:
    zout.writestr(f, zin.read(f))
zin.close()
zout.close()
os.replace(tmp, APK)
print(f'Stripped {removed} x86/x86_64 libs ({len(stripped)} files kept)')

# Re-sign if apksigner and keystore are available
keystore = sys.argv[2] if len(sys.argv) > 2 else 'app/debug.keystore'
storepass = sys.argv[3] if len(sys.argv) > 3 else 'android'
keyalias = sys.argv[4] if len(sys.argv) > 4 else 'androiddebugkey'
keypass = sys.argv[5] if len(sys.argv) > 5 else 'android'

apksigner_paths = [
    os.path.expanduser('~/Android/Sdk/build-tools/37.0.0/apksigner'),
    os.path.expanduser('~/Android/Sdk/build-tools/36.1.0/apksigner'),
    os.path.expanduser('~/Android/Sdk/build-tools/36.0.0/apksigner'),
    os.path.expanduser('~/Android/Sdk/build-tools/35.0.0/apksigner'),
]
apksigner = None
for p in apksigner_paths:
    if os.path.isfile(p):
        apksigner = p
        break

if apksigner and os.path.isfile(keystore):
    result = subprocess.run([
        apksigner, 'sign',
        '--ks', keystore,
        '--ks-pass', f'pass:{storepass}',
        '--ks-key-alias', keyalias,
        '--key-pass', f'pass:{keypass}',
        APK,
    ], capture_output=True, text=True)
    if result.returncode == 0:
        print(f'Re-signed APK ({apksigner})')
    else:
        print(f'WARNING: apksigner failed: {result.stderr.strip()}')
else:
    print('WARNING: apksigner or keystore not found, APK is unsigned/invalid')
