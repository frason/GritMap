#!/usr/bin/env python3
"""Read bounded BLE diagnostics without select/text-buffer stalls. Never toggles Bluetooth."""
import argparse
import re
import subprocess
import threading

EVENT = re.compile(r'\bble_(?:connected|resume(?:_verified)?|resource|imported|transfer_failed|test_disconnect(?:ed)?)\b')
MAC = re.compile(r'(?:[0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}')


def iter_ble_events(stream):
    # Iterate readline directly: select(fd) can miss lines already held in TextIOWrapper's buffer.
    for line in stream:
        if EVENT.search(line):
            yield MAC.sub('[device]', line.rstrip())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--adb', default='adb')
    parser.add_argument('--serial', required=True)
    parser.add_argument('--seconds', type=int, default=240)
    args = parser.parse_args()
    if not 1 <= args.seconds <= 1800:
        parser.error('--seconds must be between 1 and 1800')
    process = subprocess.Popen(
        [args.adb, '-s', args.serial, 'logcat', '-T', '1', '-v', 'threadtime', '-s', 'GritMapLive:I', '*:S'],
        stdout=subprocess.PIPE, text=True, bufsize=1,
    )
    timer = threading.Timer(args.seconds, process.terminate)
    timer.daemon = True
    timer.start()
    print('MONITOR READY (read-only; no radio toggles)', flush=True)
    try:
        for line in iter_ble_events(process.stdout):
            print(line, flush=True)
            if 'ble_imported ' in line or 'ble_transfer_failed ' in line:
                break
    except KeyboardInterrupt:
        pass
    finally:
        timer.cancel()
        process.terminate()
        try:
            process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()


if __name__ == '__main__':
    main()
