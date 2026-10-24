#!/usr/bin/env python3
import importlib.util
from pathlib import Path
import signal
import subprocess
import sys
import unittest

spec = importlib.util.spec_from_file_location('monitor', Path(__file__).with_name('monitor-karoo-ble.py'))
monitor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(monitor)


class MonitorTest(unittest.TestCase):
    def test_two_events_from_one_flush_are_consumed_without_more_pipe_activity(self):
        child = subprocess.Popen([sys.executable, '-u', '-c',
            'import time; print("I GritMapLive: ble_connected mtu=517\\nI GritMapLive: ble_resume resource=segment offset=8192", flush=True); time.sleep(30)'],
            stdout=subprocess.PIPE, text=True)
        def deadline(*_):
            raise TimeoutError('Buffered event was not consumed')
        previous = signal.signal(signal.SIGALRM, deadline)
        signal.alarm(3)
        try:
            events = monitor.iter_ble_events(child.stdout)
            self.assertIn('ble_connected', next(events))
            self.assertIn('offset=8192', next(events))
        finally:
            signal.alarm(0)
            signal.signal(signal.SIGALRM, previous)
            child.terminate()
            child.wait()
            child.stdout.close()

    def test_unrelated_logs_are_dropped_and_mac_is_redacted(self):
        lines = ['private unrelated text\n', 'I GritMapLive: ble_resume device=01:23:45:67:89:ab offset=8192\n']
        self.assertEqual(['I GritMapLive: ble_resume device=[device] offset=8192'], list(monitor.iter_ble_events(lines)))


if __name__ == '__main__':
    unittest.main()
