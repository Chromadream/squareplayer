# squareplayer

A completely opinionated (you'll see why) music player utilizing Retroid Pocket Classic's glorious square-ish OLED screen.

## Features

* Basic music playing (play/pause, seek, prev/next track)
* Fully controllable with a gamepad
* Full-screen cover art on Now Playing page
* Folder view
* Favorite tracks

That sounds normal, where is the opinionated part?

* It defaults to Repeat Track (overrideable below)
* It has a specific way to structure your folders

## Screenshots

coming soon...

## installation

Download the most recent release [here](https://github.com/Chromadream/squareplayer/releases/latest)

## Folder structure

Any other structure will not work. This is made intentionally as flat as possible since this is how I'd like to structure my music on handhelds. The names don't matter, just the folder structures.

```
root/
├── a track.flac
├── another track.mp3
├── Folder 1/
│   ├── cover.jpeg
│   ├── track 1.flac
│   ├── track 2.flac
│   └── [more tracks...]
├── multidisc folder/
│   ├── Disc 1/
│   │   ├── CoverArt.png
│   │   ├── track 1.flac
│   │   ├── track 2.flac
│   │   └── [more tracks...]
│   └── Disc 2/
│       ├── track 1.flac
│       ├── track 2.flac
│       └── [more tracks...]
├── Album Experience/
│   ├── .album
│   ├── cover.png
│   ├── track 1.flac
│   ├── track 2.flac
│   └── [more tracks...]
└── multidisc Album Experience/
    ├── .album
    ├── cover.png
    ├── Disc 1/
    │   ├── track 1.flac
    │   ├── track 2.flac
    │   └── [more tracks...]
    └── Disc 2/
        ├── track 1.flac
        ├── track 2.flac
        └── [more tracks...]
```

### What is the `.album` file?

It is an empty file denoting that when playing the folder, the mode should not be a Repeat Track mode, but Repeat Folder instead.

## will this go open-source?

At some point, yes, but not today.
