package game

import (
	"strings"
	"testing"
)

type unsupportedStateUpdate struct{}

func (unsupportedStateUpdate) iClientMessage() {}

func TestParseNameMessage(t *testing.T) {
	tests := []struct {
		name      string
		payload   []byte
		want      string
		wantError bool
	}{
		{
			name:    "valid name",
			payload: []byte("name: Player One "),
			want:    "Player One",
		},
		{
			name:      "empty name",
			payload:   []byte("name:   "),
			wantError: true,
		},
		{
			name:      "invalid UTF-8",
			payload:   []byte{'n', 'a', 'm', 'e', ':', 0xff},
			wantError: true,
		},
		{
			name:      "name too long",
			payload:   []byte("name:" + strings.Repeat("a", maxNameLength+1)),
			wantError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := parseNameMessage(tt.payload)
			if tt.wantError {
				if err == nil {
					t.Fatal("parseNameMessage() expected an error")
				}
				return
			}

			if err != nil {
				t.Fatalf("parseNameMessage() error = %v", err)
			}
			if got != tt.want {
				t.Fatalf("parseNameMessage() = %q, want %q", got, tt.want)
			}
		})
	}
}
