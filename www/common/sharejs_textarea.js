define(function () {

/**
 * Licensed under the standard MIT license:
 *
 * Copyright 2011 Joseph Gentle.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * See: https://github.com/share/ShareJS/blob/master/LICENSE
 */

/* This contains the textarea binding for ShareJS. This binding is really
 * simple, and a bit slow on big documents (Its O(N). However, it requires no
 * changes to the DOM and no heavy libraries like ace. It works for any kind of
 * text input field.
 *
 * You probably want to use this binding for small fields on forms and such.
 * For code editors or rich text editors or whatever, I recommend something
 * heavier.
 */


/* applyChange creates the edits to convert oldval -> newval.
 *
 * This function should be called every time the text element is changed.
 * Because changes are always localised, the diffing is quite easy. We simply
 * scan in from the start and scan in from the end to isolate the edited range,
 * then delete everything that was removed & add everything that was added.
 * This wouldn't work for complex changes, but this function should be called
 * on keystroke - so the edits will mostly just be single character changes.
 * Sometimes they'll paste text over other text, but even then the diff
 * generated by this algorithm is correct.
 *
 * This algorithm is O(N). I suspect you could speed it up somehow using regular expressions.
 */
var applyChange = function(ctx, oldval, newval) {
    // Strings are immutable and have reference equality. I think this test is O(1), so its worth doing.
    if (oldval === newval) return;

    var commonStart = 0;
    while (oldval.charAt(commonStart) === newval.charAt(commonStart)) {
        commonStart++;
    }

    var commonEnd = 0;
    while (oldval.charAt(oldval.length - 1 - commonEnd) === newval.charAt(newval.length - 1 - commonEnd) &&
        commonEnd + commonStart < oldval.length && commonEnd + commonStart < newval.length) {
        commonEnd++;
    }

    var bugz = {
        commonStart:commonStart,
        commonEnd:commonEnd,
        oldvalLength: oldval.length,
        newvalLength: newval.length
    };
    if (oldval.length !== commonStart + commonEnd) {
        if (ctx.localChange) { ctx.localChange(true); }
        ctx.remove(commonStart, oldval.length - commonStart - commonEnd);
    }
    if (newval.length !== commonStart + commonEnd) {
        if (ctx.localChange) { ctx.localChange(true); }
        ctx.insert(commonStart, newval.slice(commonStart, newval.length - commonEnd));
    }
};

/**
 * Fix issues with textarea content which is different per-browser.
 */
var cannonicalize = function (content) {

    return content.replace(/\r\n/g, '\n');
};

// Attach a textarea to a document's editing context.
//
// The context is optional, and will be created from the document if its not
// specified.
var attachTextarea = function(elem, ctx) {

    // initial state will always fail the !== check in genop.
    var content = {};
    var newSelection;

    // Replace the content of the text area with newText, and transform the
    // current cursor by the specified function.
    var replaceText = function(newText, transformCursor) {
        if (transformCursor) {
            newSelection = [transformCursor(elem.selectionStart), transformCursor(elem.selectionEnd)];
        }

        // Fixate the window's scroll while we set the element's value. Otherwise
        // the browser scrolls to the element.
        var scrollTop = elem.scrollTop;
        elem.value = newText;
        content = elem.value; // Not done on one line so the browser can do newline conversion.
        if (elem.scrollTop !== scrollTop) elem.scrollTop = scrollTop;

        // Setting the selection moves the cursor. We'll just have to let your
        // cursor drift if the element isn't active, though usually users don't
        // care.
        if (newSelection && window.document.activeElement === elem) {
            elem.selectionStart = newSelection[0];
            elem.selectionEnd = newSelection[1];
        }
    };

  //replaceText(ctx.get());


  // *** remote -> local changes

  ctx.onRemove(function(pos, length) {
    var transformCursor = function(cursor) {
      // If the cursor is inside the deleted region, we only want to move back to the start
      // of the region. Hence the Math.min.
      return pos < cursor ? cursor - Math.min(length, cursor - pos) : cursor;
    };
    replaceText(ctx.getUserDoc(), transformCursor);
  });

  ctx.onInsert(function(pos, text) {
    var transformCursor = function(cursor) {
      return pos < cursor ? cursor + text.length : cursor;
    };
    replaceText(ctx.getUserDoc(), transformCursor);
  });


  // *** local -> remote changes

  // This function generates operations from the changed content in the textarea.
  var genOp = function() {
    // In a timeout so the browser has time to propogate the event's changes to the DOM.
    setTimeout(function() { var val = elem.value;
      if (val !== content) {
        applyChange(ctx, ctx.getUserDoc(), cannonicalize(val));
      }
    }, 0);
  };

  var eventNames = ['textInput', 'keydown', 'keyup', 'select', 'cut', 'paste'];
  for (var i = 0; i < eventNames.length; i++) {
    var e = eventNames[i];
    if (elem.addEventListener) {
      elem.addEventListener(e, genOp, false);
    } else {
      elem.attachEvent('on' + e, genOp);
    }
  }

  ctx.detach = function() {
    for (var i = 0; i < eventNames.length; i++) {
      var e = eventNames[i];
      if (elem.removeEventListener) {
        elem.removeEventListener(e, genOp, false);
      } else {
        elem.detachEvent('on' + e, genOp);
      }
    }
  };

  ctx.bumpSharejs = genOp;

  return ctx;
};

return { attach: attachTextarea };
});
