"""Encode the three real browser recordings as one browser-compatible MP4.
Run after capture.cjs, from the repository root: python3 docs/demo/render-video.py
Requires ffmpeg and ffprobe on PATH. No Python packages are needed.
"""
import json
import datetime
import pathlib
import subprocess

root = pathlib.Path('.local')
clips = [('host', 'Teacher: sign up, create and save a custom quiz'),
         ('player', 'Guest: join 12 players, answer, view results and replay'),
         ('solo', 'Solo: play a complete five-question round')]
chapters = []
position = 0.0
for name, title in clips:
    source = root / f'readme-{name}.webm'
    duration = float(json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'json', str(source)
    ]))['format']['duration'])
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(source),
                    '-vf', 'fps=30,setsar=1', '-c:v', 'libx264', '-preset', 'slow',
                    '-crf', '17', '-pix_fmt', 'yuv420p', '-an',
                    str(root / f'readme-{name}.mp4')], check=True)
    chapters.append({'title': title, 'start': round(position, 3), 'duration': duration})
    position += duration
(root / 'readme-concat.txt').write_text(''.join(f"file 'readme-{name}.mp4'\n" for name, _ in clips))
metadata = ';FFMETADATA1\ntitle=Quiz — a complete application workflow\n'
for chapter in chapters:
    metadata += f"[CHAPTER]\nTIMEBASE=1/1000\nSTART={round(chapter['start']*1000)}\nEND={round((chapter['start']+chapter['duration'])*1000)}\ntitle={chapter['title']}\n"
(root / 'readme-chapters.txt').write_text(metadata)
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0',
                '-i', str(root / 'readme-concat.txt'), '-i', str(root / 'readme-chapters.txt'),
                '-map_metadata', '1', '-c', 'copy', '-movflags', '+faststart',
                'docs/media/video/quiz-walkthrough.mp4'], check=True)
pathlib.Path('docs/evidence/video.json').write_text(json.dumps({
    'capturedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'applicationRevision': subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip(),
    'ui': 'Peach Playground',
    'width': 1440, 'height': 1000, 'fps': 30, 'codec': 'H.264',
    'sizeBytes': pathlib.Path('docs/media/video/quiz-walkthrough.mp4').stat().st_size,
    'durationSeconds': round(position, 3), 'audio': 'silent', 'chapters': chapters
}, indent=2) + '\n')
print(f'Published {position:.1f}s at 1440 × 1000, 30 fps.')
