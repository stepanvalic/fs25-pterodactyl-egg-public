#!/bin/bash
set -eu
printf 'call\n' >> "$FAKE_CALLS"
output=''
portal=false
head=false
while [ "$#" -gt 0 ]; do
    case "$1" in
        -o) output="$2"; shift ;;
        --data) portal=true; shift ;;
        -sI) head=true ;;
    esac
    shift
done
if "$portal"; then
    [ "${FAKE_FAIL:-false}" = false ] || exit 22
    printf '<a href="https://cdn.giants-software.com/test/FarmingSimulator25_test_ESD.img">test</a>' > "$output"
elif "$head"; then
    printf 'Content-Length: 4\r\n'
else
    if [ "${FAKE_TRANSFER_FAIL:-false}" = true ]; then
        printf 'te' > "$output"
        exit 7
    fi
    printf 'test' > "$output"
fi
