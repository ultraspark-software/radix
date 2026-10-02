export interface RadTimeOptions
{
	type?: 'digital' | 'analog';
	hour12?: boolean;             // For digital mode (true = 12h, false = 24h)
	showDate?: boolean;
	dateFormat?: string;          // e.g., 'en-US', 'en-GB', or custom locale
	showWeather?: boolean;
	cssClass?: string;
}


export class RadControls
{
	/*
	 * escapeHtml
	 *
	 * Escapes HTML special characters in a string to prevent XSS attacks.
	 * @param value The string to escape.
	 * @returns The escaped string.
	 */
	private escapeHtml(value: string): string
	{
		return value.replace(/[&<>"']/g, (character) => {
			const entities: Record<string, string> = {
				"&": "&amp;",
				"<": "&lt;",
				">": "&gt;",
				'"': "&quot;",
				"'": "&#39;",
			};

			return entities[character];
		});
	}


	/*
	 * RadButton
	 *
	 * Creates an HTML button element with the specified properties.
	 * @param url The URL the button links to.
	 * @param title The text to display on the button.
	 * @param css The CSS classes for the button.
	 * @param newWindow Whether to open the link in a new tab.
	 * @returns The HTML string for the button.
	 */
	public RadButton(url: string, title: string, css: string, newWindow = false,): string
	{
		const targetAttributes = newWindow
			? ' target="_blank" rel="noopener noreferrer"'
			: "";

		return `<a href="${this.escapeHtml(url)}" class="btn ${this.escapeHtml(css)} d-block w-100"${targetAttributes}>${this.escapeHtml(title)}</a>`;
	}


	/*
	 * RadTime
	 */
public RadTime(options: RadTimeOptions = {}): string {
    const {
      type = 'digital',
      hour12 = true,
      showDate = false,
      dateFormat = 'en-US',
      showWeather = false,
      cssClass = ''
    } = options;

    const id = `radtime-${Math.random().toString(36).substring(2, 9)}`;

    if (type === 'analog') {
      return `
        <div id="${id}" class="radtime radtime-analog ${cssClass}" style="display: inline-block; text-align: center; font-family: system-ui, sans-serif;">
          <div class="clock-face" style="position: relative; width: 120px; height: 120px; border: 3px solid #333; border-radius: 50%; margin: 0 auto; background: #fff;">
            <div class="hand hour-hand" style="position: absolute; bottom: 50%; left: 50%; width: 4px; height: 35px; background: #333; transform-origin: bottom center; transform: translateX(-50%) rotate(0deg); border-radius: 2px;"></div>
            <div class="hand min-hand" style="position: absolute; bottom: 50%; left: 50%; width: 3px; height: 48px; background: #666; transform-origin: bottom center; transform: translateX(-50%) rotate(0deg); border-radius: 2px;"></div>
            <div class="hand sec-hand" style="position: absolute; bottom: 50%; left: 50%; width: 1px; height: 52px; background: #e74c3c; transform-origin: bottom center; transform: translateX(-50%) rotate(0deg);"></div>
            <div class="center-dot" style="position: absolute; top: 50%; left: 50%; width: 8px; height: 8px; background: #333; border-radius: 50%; transform: translate(-50%, -50%);"></div>
          </div>
          ${showDate ? `<div class="radtime-date" style="margin-top: 6px; font-size: 0.85rem; font-weight: 500;"></div>` : ''}
          ${showWeather ? `<div class="radtime-weather" style="font-size: 0.8rem; color: #555; margin-top: 2px;">Loading weather...</div>` : ''}
        </div>
        <script>${this.getClockScript(id, 'analog', hour12, showDate, dateFormat, showWeather)}</script>
      `;
    }

    // Digital mode default
    return `
      <div id="${id}" class="radtime radtime-digital ${cssClass}" style="display: inline-block; font-family: monospace, system-ui; font-size: 1.25rem;">
        <span class="radtime-time" style="font-weight: bold;">--:--:--</span>
        ${showDate ? `<div class="radtime-date" style="font-size: 0.85rem; font-weight: normal; color: #555;"></div>` : ''}
        ${showWeather ? `<div class="radtime-weather" style="font-size: 0.8rem; font-weight: normal; color: #666;">Loading weather...</div>` : ''}
      </div>
      <script>${this.getClockScript(id, 'digital', hour12, showDate, dateFormat, showWeather)}</script>
    `;
  }

  private getClockScript(
    id: string,
    type: string,
    hour12: boolean,
    showDate: boolean,
    locale: string,
    showWeather: boolean
  ): string {
    return `
      (function() {
        const root = document.getElementById('${id}');
        if (!root) return;

        function updateClock() {
          const now = new Date();

          if ('${type}' === 'digital') {
            const timeEl = root.querySelector('.radtime-time');
            if (timeEl) {
              timeEl.textContent = now.toLocaleTimeString('${locale}', { hour12: ${hour12} });
            }
          } else {
            const sec = now.getSeconds();
            const min = now.getMinutes();
            const hr = now.getHours();

            const secDeg = (sec / 60) * 360;
            const minDeg = ((min + sec / 60) / 60) * 360;
            const hrDeg = (((hr % 12) + min / 60) / 12) * 360;

            const secEl = root.querySelector('.sec-hand');
            const minEl = root.querySelector('.min-hand');
            const hrEl = root.querySelector('.hour-hand');

            if (secEl) secEl.style.transform = \`translateX(-50%) rotate(\${secDeg}deg)\`;
            if (minEl) minEl.style.transform = \`translateX(-50%) rotate(\${minDeg}deg)\`;
            if (hrEl) hrEl.style.transform = \`translateX(-50%) rotate(\${hrDeg}deg)\`;
          }

          ${showDate ? `
            const dateEl = root.querySelector('.radtime-date');
            if (dateEl) {
              dateEl.textContent = now.toLocaleDateString('${locale}', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
            }
          ` : ''}
        }

        updateClock();
        setInterval(updateClock, 1000);

        ${showWeather ? `
          function fetchWeather() {
            const weatherEl = root.querySelector('.radtime-weather');
            if (!weatherEl || !navigator.geolocation) {
              if (weatherEl) weatherEl.textContent = 'Weather unavailable';
              return;
            }

            navigator.geolocation.getCurrentPosition(
              async (pos) => {
                try {
                  const lat = pos.coords.latitude;
                  const lon = pos.coords.longitude;
                  const res = await fetch(\`https://api.open-meteo.com/v1/forecast?latitude=\${lat}&longitude=\${lon}&current_weather=true\`);
                  const data = await res.json();
                  if (data && data.current_weather) {
                    const temp = Math.round(data.current_weather.temperature);
                    const code = data.current_weather.weathercode;
                    const desc = getWeatherCondition(code);
                    weatherEl.textContent = \`\${temp}°C, \${desc}\`;
                  }
                } catch(e) {
                  weatherEl.textContent = 'Weather error';
                }
              },
              () => { if (weatherEl) weatherEl.textContent = 'Location denied'; }
            );
          }

          function getWeatherCondition(code) {
            if (code === 0) return 'Clear ☀️';
            if (code <= 3) return 'Partly Cloudy ⛅';
            if (code <= 48) return 'Foggy 🌫️';
            if (code <= 67) return 'Rain 🌧️';
            if (code <= 77) return 'Snow ❄️';
            return 'Storm 🌩️';
          }

          fetchWeather();
        ` : ''}
      })();
    `;
  }

	
}
