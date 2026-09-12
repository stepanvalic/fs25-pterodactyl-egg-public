# Installation diagnostics

During base-game extraction and setup, the console prints disk snapshots before,
after, and every 30 seconds during each step. Snapshots include filesystem free
space, inode availability and KiB usage for installer, game, Wine prefix, data,
and /tmp. The Wine-prefix total includes the game: do not add them together.

Persistent logs are saved under `data/install-logs/` with a unique run ID:

- `*-disk.log`: disk snapshots.
- `*-setup.log`: Inno Setup's detailed `/LOG` output.
- `*-wine.log`: Wine/installer standard output and errors.

No environment dump or shell tracing is enabled. Treat diagnostic logs as
private because installer-generated logs can contain local paths. Do not commit
runtime logs or upload them to a public repository without reviewing them.

`df` reports filesystem availability, not necessarily the Pterodactyl/Wings
server disk quota. A Wings quota stop can occur despite free space in `df`.
With `KEEP_INSTALLER=true`, the distribution IMG, extracted setup payload and
installed game coexist. Budget for all three, Wine, mods, saves and temporary
files. Raising only the virtual disk capacity does not raise the panel quota.

An interrupted extraction retains `.extract-incomplete` and retries extraction
on the next attempt. An interrupted base installation retains
`installer/.install-incomplete`. The next start retries setup instead of treating
an early-created `dedicatedServer.exe` as proof of success. Older installations
without the marker are checked for key executables and game data; this is a
sanity check, not a full integrity verification.

No installer, savegame or mod is automatically deleted for diagnostics. Fix the
disk quota/capacity before retrying. Hard termination (SIGKILL) cannot produce a
final snapshot, but earlier snapshots remain available.

For a temporary SFTP deployment before a new image is available, upload `yolk/start.sh`
and the complete `yolk/lib` directory under `fs25-debug/` in the server root, then
use this startup command:

```sh
FS25_LIB=/home/container/fs25-debug/lib bash /home/container/fs25-debug/start.sh
```

After pulling an image containing these changes, restore `bash /opt/fs25/start.sh`.

Inno Setup logging reference: https://jrsoftware.org/ishelp/topic_setupcmdline.htm
