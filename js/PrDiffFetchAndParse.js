/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 */
function startsWith(str, start) {
  return str.substr(0, start.length) === start;
}

function parseDiffFile(lines) {
  var deletedLines = [];
  var addedLines = [];

  // diff --git a/path b/path
  var line = lines.pop();
  if (!line.match(/^diff --git a\//)) {
    throw new Error('Invalid line, should start with `diff --git a/`, instead got \n' + line + '\n');
  }
  var fromFile = line.replace(/^diff --git a\/(.+) b\/.+/g, '$1');

  // index sha..sha mode
  line = lines.pop();
  if (startsWith(line, 'deleted file') ||
      startsWith(line, 'new file')) {
    line = lines.pop();
  }

  line = lines.pop();
  if (startsWith(line, 'Binary files')) {
    // We just ignore binary files (mostly images). If we want to improve the
    // precision in the future, we could look at the history of those files
    // to get more names.
  } else if (startsWith(line, '--- ')) {
    // +++ path
    line = lines.pop();
    if (!line.match(/^\+\+\+ /)) {
      throw new Error('Invalid line, should start with `+++`, instead got \n' + line + '\n');
    }

    var currentFromLine = 0;
    while (lines.length > 0) {
      line = lines.pop();
      if (startsWith(line, 'diff --git')) {
        lines.push(line);
        break;
      }

      // @@ -from_line,from_count +to_line,to_count @@ first line
      if (startsWith(line, '@@')) {
        var matches = line.match(/^\@\@ -([0-9]+),?([0-9]+)? \+([0-9]+),?([0-9]+)? \@\@/);
        if (!matches) {
          continue;
        }

        var from_line = matches[1];
        var from_count = matches[2];
        var to_line = matches[3];
        var to_count = matches[4];

        currentFromLine = +from_line;
        continue;
      }

      if (startsWith(line, '-')) {
        deletedLines.push(currentFromLine);
      } else if (startsWith(line, '+')) {
        addedLines.push(currentFromLine);
      }
      currentFromLine++;
    }
  }

  return {
    path: fromFile,
    deletedLines: deletedLines,
    addedLines: addedLines
  };
}

function parseDiff(diff) {
  var files = [];
  // The algorithm is designed to be best effort. If the http request failed
  // for some reason and we get an empty file, we should not crash.
  if (!diff || !diff.match(/^diff/)) {
    return files;
  }

  var lines = diff.trim().split('\n');
  // Hack Array doesn't have shift/unshift to work from the beginning of the
  // array, so we reverse the entire array in order to be able to use pop/add.
  lines.reverse();

  while (lines.length > 0) {
    files.push(parseDiffFile(lines));
  }

  return files;
}
