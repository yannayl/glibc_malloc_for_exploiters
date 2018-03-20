/*!
 * reveal-code-focus 0.1.1
 * Copyright 2015-2016 Benjamin Tan <https://demoneaux.github.io/>
 * Available under MIT license <https://github.com/demoneaux/reveal-code-focus/blob/master/LICENSE>
 */
;(function(window, Reveal, hljs) {
  if (typeof window.RevealCodeFocus == 'function') {
    return;
  }

  var currentSlide, currentFragments, scrollToFocused, prevSlideData = null;

  function forEach(array, callback) {
    var i = -1, length = array ? array.length : 0;
    while (++i < length) {
      callback(array[i]);
    }
  }

  function indexOf(array, elem) {
    var i = -1, length = array ? array.length : 0;
    while (++i < length) {
      if (array[i] === elem) {
        return i;
      }
    }
  }

  var ran;
  function init(e) {
    // Initialize code only once.
    // TODO: figure out why `init` is being called twice.
    if (ran) {
      return;
    }
    ran = true;

    forEach(document.querySelectorAll('pre code'), function(element) {
      // Trim whitespace if the `data-trim` attribute is present.
      if (element.hasAttribute('data-trim') && typeof element.innerHTML.trim == 'function') {
        element.innerHTML = element.innerHTML.trim();
      }

      // Highlight code using highlight.js.
      hljs.highlightBlock(element);

      // Split highlighted code into lines.
      var openTags = [], reHtmlTag = /<(\/?)span(?:\s+(?:class=(['"])hljs-.*?\2)?\s*|\s*)>/g;
      element.innerHTML = element.innerHTML.replace(/(.*?)\r?\n/g, function(_, string) {
        if (!string) {
          return '<span class=line>&nbsp;</span>';
        }
        var openTag, stringPrepend;
        // Re-open all tags that were previously closed.
        if (openTags.length) {
          stringPrepend = openTags.join('');
        }
        // Match all HTML `<span>` tags.
        reHtmlTag.lastIndex = 0;
        while (openTag = reHtmlTag.exec(string)) {
          // If it is a closing tag, remove the opening tag from the list.
          if (openTag[1]) {
            openTags.pop();
          }
          // Otherwise if it is an opening tag, push it to the list.
          else {
            openTags.push(openTag[0]);
          }
        }
        // Close all opened tags, so that strings can be wrapped with `span.line`.
        if (openTags.length) {
          string += Array(openTags.length + 1).join('</span>');
        }
        if (stringPrepend) {
          string = stringPrepend + string;
        }
        return '<span class=line>' + string + '</span>';
      });
    });

    Reveal.addEventListener('slidechanged', updateCurrentSlide);

    Reveal.addEventListener('fragmentshown', function(e) {
      focusFragment(e.fragment);
    });

    // When a fragment is hidden, clear the current focused fragment,
    // and focus on the previous fragment.
    Reveal.addEventListener('fragmenthidden', function(e) {
      var index = indexOf(currentFragments, e.fragment);
      focusFragment(currentFragments[index - 1]);
    });

    updateCurrentSlide(e);
  }

  function updateCurrentSlide(e) {
    currentSlide = e.currentSlide;
    currentFragments = currentSlide.getElementsByClassName('fragment');
    clearPreviousFocus();
    if (
        currentFragments.length &&
        prevSlideData &&
        (
          prevSlideData.indexh > e.indexh ||
          (prevSlideData.indexh == e.indexh && prevSlideData.indexv > e.indexv)
        )
    ) {
      while (Reveal.nextFragment()) {}
      var currentFragment = currentFragments[currentFragments.length - 1];
      currentFragment.classList.add('current-fragment');
      focusFragment(currentFragment);
    }
    // Update previous slide information.
    prevSlideData = {
      'indexh': e.indexh,
      'indexv': e.indexv
    };
  }

  // Remove
  function clearPreviousFocus() {
    forEach(currentSlide.querySelectorAll('pre code .line.focus'), function(line) {
      line.classList.remove('focus');
    });
  }

  function focusFragment(fragment) {
    clearPreviousFocus();
    if (!fragment) {
      return;
    }

    var lines = fragment.getAttribute('data-code-focus');
    if (!lines) {
      return;
    }

    var code = currentSlide.querySelectorAll('pre code .line'),
        codeParent, scrollLineTop, scrollLineBottom;

    function focusLine(lineNumber) {
      var line = code[lineNumber - 1];
      if (!line) {
        return;
      }

      line.classList.add('focus');

      if (scrollLineTop == null) {
        scrollLineTop = scrollLineBottom = lineNumber - 1;
      } else {
        scrollLineTop = Math.min(scrollLineTop, line.offsetTop);
        scrollLineBottom = Math.max(scrollLineBottom, lineNumber - 1);
      }
    }

    forEach(lines.split(','), function(line) {
      lines = line.split('-');
      if (lines.length == 1) {
        focusLine(lines[0]);
      } else {
        var i = lines[0] - 1, j = lines[1];
        while (++i <= j) {
          focusLine(i);
        }
      }
    });

    if (scrollToFocused && scrollLineTop != null) {
      codeParent = code[scrollLineTop].parentNode;
      scrollLineTop = code[scrollLineTop].offsetTop;
      scrollLineBottom = code[scrollLineBottom].offsetTop + code[scrollLineBottom].clientHeight;
      codeParent.scrollTop = scrollLineTop - (codeParent.clientHeight - (scrollLineBottom - scrollLineTop)) / 2;
    }
  }

  function RevealCodeFocus(options) {
    options || (options = {
      'scrollToFocused': true
    });

    if (options.scrollToFocused != null) {
      scrollToFocused = options.scrollToFocused;
    }

    if (Reveal.isReady()) {
      init({ currentSlide: Reveal.getCurrentSlide() });
    } else {
      Reveal.addEventListener('ready', init);
    }
  }

  window.RevealCodeFocus = RevealCodeFocus;
}(this, this.Reveal, this.hljs));
