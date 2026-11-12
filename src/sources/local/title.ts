// Only a short alphanumeric tail counts as an extension, so "Mr. Brightside" keeps its title.
const EXTENSION = /\.[A-Za-z0-9]{1,5}$/;
// "01 - ", "1. ", "01 ", "1-02 ". A bare number followed by a space only counts when it is
// zero-padded or a disc-track pair, so "99 Problems" and "7 Rings" keep their numbers.
const LEADING_TRACK_NUMBER =
  /^(?:\d{1,3}(?:-\d{1,3})?(?:\s+[-–—]\s+|\.\s+)|0\d{1,2}\s+|\d{1,2}-\d{1,3}\s+)/;
const ARTIST_SEPARATOR = /\s[-–—]\s/;

function tidy(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Best-effort title and artist from a file name such as "01 - Artist - Title.mp3". */
export function trackInfoFromFileName(name: string): { title: string; artist: string } {
  const base = name.replace(EXTENSION, '');
  const text = tidy(tidy(base.replace(/_/g, ' ')).replace(LEADING_TRACK_NUMBER, ''));

  let artist = '';
  let title = text;
  const match = ARTIST_SEPARATOR.exec(text);
  if (match) {
    artist = tidy(text.slice(0, match.index));
    title = tidy(text.slice(match.index + match[0].length));
  }

  if (title === '') {
    return { title: tidy(base) || 'Untitled', artist: '' };
  }
  return { title, artist };
}
