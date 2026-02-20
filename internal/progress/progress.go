// Package progress provides a simple terminal progress bar.
package progress

import (
	"fmt"
	"io"
	"os"
	"strings"
)

const barWidth = 20

// Reader wraps an io.Reader and draws a progress bar on stderr.
type Reader struct {
	r       io.Reader
	total   int64
	current int64
	done    bool
}

// NewReader creates a progress bar wrapping r.
func NewReader(r io.Reader, total int64) *Reader {
	return &Reader{r: r, total: total}
}

// Read implements io.Reader.
func (p *Reader) Read(b []byte) (int, error) {
	n, err := p.r.Read(b)
	p.current += int64(n)

	if err == io.EOF {
		if !p.done {
			p.done = true
			p.renderFull()
		}
	} else {
		p.render()
	}
	return n, err
}

func (p *Reader) render() {
	if p.total <= 0 {
		fmt.Fprintf(os.Stderr, "\r   %s  (%s)", strings.Repeat("░", barWidth), fmtBytes(p.current))
		return
	}
	pct := float64(p.current) / float64(p.total)
	if pct > 1 {
		pct = 1
	}
	filled := int(pct * float64(barWidth))
	bar := strings.Repeat("█", filled) + strings.Repeat("░", barWidth-filled)
	fmt.Fprintf(os.Stderr, "\r   %s %3.0f%%", bar, pct*100)
}

func (p *Reader) renderFull() {
	bar := strings.Repeat("█", barWidth)
	fmt.Fprintf(os.Stderr, "\r   %s 100%%\n", bar)
}

// Finish forces the bar to 100%.
func (p *Reader) Finish() {
	if !p.done {
		p.done = true
		p.renderFull()
	}
}

// PrintDone prints a completed bar.
func PrintDone() {
	bar := strings.Repeat("█", barWidth)
	fmt.Fprintf(os.Stderr, "   %s 100%%\n", bar)
}

func fmtBytes(n int64) string {
	const unit = 1024
	if n < unit {
		return fmt.Sprintf("%d B", n)
	}
	div, exp := int64(unit), 0
	for v := n / unit; v >= unit; v /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(n)/float64(div), "KMGTPE"[exp])
}
