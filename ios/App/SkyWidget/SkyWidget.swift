// Home Screen and Lock Screen widgets: Puff dressed for the weather, the temperature and a message.
// The widget fetches the weather itself from Open-Meteo (free, no key) so it
// stays fresh even when the app isn't open.

import WidgetKit
import SwiftUI
import CoreLocation

// MARK: - Data

struct SkyEntry: TimelineEntry {
    let date: Date
    let place: String
    let tempC: Double
    let code: Int
    let isDay: Bool
    let windKmh: Double
    let highC: Double
    let lowC: Double
    var failed = false

    var kind: SkyKind { SkyKind(code: code) }
    var puff: SkyPuff { SkyPuff.forWeather(code: code, tempC: tempC, windKmh: windKmh, isDay: isDay, date: date) }
    var fahrenheit: Bool { SkyText.prefersFahrenheit }
    var temp: String { SkyText.temp(tempC, fahrenheit: fahrenheit) }
    var condition: String { SkyText.label(code: code) }

    static let sample = SkyEntry(date: Date(), place: "London", tempC: 18, code: 2, isDay: true, windKmh: 12, highC: 21, lowC: 12)
}

private struct ForecastResponse: Decodable {
    struct Current: Decodable {
        let temperature_2m: Double
        let weather_code: Int
        let is_day: Int
        let wind_speed_10m: Double
    }
    struct Hourly: Decodable {
        let time: [Double]
        let temperature_2m: [Double]
        let weather_code: [Int]
        let is_day: [Int]
        let wind_speed_10m: [Double]
    }
    struct Daily: Decodable {
        let temperature_2m_max: [Double]
        let temperature_2m_min: [Double]
    }
    let current: Current
    let hourly: Hourly
    let daily: Daily
}

/// Gets a place: the one saved by the app (if App Groups are on), else your location, else London.
private final class PlaceFinder: NSObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    private var continuation: CheckedContinuation<CLLocation?, Never>?

    func find() async -> (lat: Double, lon: Double, name: String?) {
        if let shared = UserDefaults(suiteName: skyAppGroup),
           shared.object(forKey: "lat") != nil {
            return (shared.double(forKey: "lat"), shared.double(forKey: "lon"), shared.string(forKey: "place"))
        }
        if manager.isAuthorizedForWidgetUpdates {
            if let recent = manager.location, recent.timestamp.timeIntervalSinceNow > -3600 {
                return (recent.coordinate.latitude, recent.coordinate.longitude, await placeName(recent))
            }
            if let fresh = await requestLocation() {
                return (fresh.coordinate.latitude, fresh.coordinate.longitude, await placeName(fresh))
            }
        }
        return (51.5085, -0.1257, "London")
    }

    private var requester: CLLocationManager?

    private func requestLocation() async -> CLLocation? {
        await withCheckedContinuation { cont in
            // Location answers only arrive for a manager made on the main thread.
            DispatchQueue.main.async {
                self.continuation = cont
                let m = CLLocationManager()
                m.delegate = self
                m.desiredAccuracy = kCLLocationAccuracyKilometer
                self.requester = m
                m.requestLocation()
                // Don't wait forever: widgets only get a few seconds.
                DispatchQueue.main.asyncAfter(deadline: .now() + 8) { self.finish(nil) }
            }
        }
    }

    private func finish(_ location: CLLocation?) {
        continuation?.resume(returning: location)
        continuation = nil
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        finish(locations.last)
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        finish(nil)
    }

    private func placeName(_ location: CLLocation) async -> String? {
        let marks = try? await CLGeocoder().reverseGeocodeLocation(location)
        return marks?.first?.locality ?? marks?.first?.name
    }
}

enum SkyFetcher {
    /// The current weather plus the next few hours, so Puff can change outfits on its own.
    static func entries() async -> [SkyEntry] {
        let place = await PlaceFinder().find()
        var comps = URLComponents(string: "https://api.open-meteo.com/v1/forecast")!
        comps.queryItems = [
            URLQueryItem(name: "latitude", value: String(format: "%.4f", place.lat)),
            URLQueryItem(name: "longitude", value: String(format: "%.4f", place.lon)),
            URLQueryItem(name: "current", value: "temperature_2m,weather_code,is_day,wind_speed_10m"),
            URLQueryItem(name: "hourly", value: "temperature_2m,weather_code,is_day,wind_speed_10m"),
            URLQueryItem(name: "daily", value: "temperature_2m_max,temperature_2m_min"),
            URLQueryItem(name: "timezone", value: "auto"),
            URLQueryItem(name: "timeformat", value: "unixtime"),
            URLQueryItem(name: "forecast_days", value: "2"),
        ]
        let name = place.name ?? "My sky"
        do {
            let (data, _) = try await URLSession.shared.data(from: comps.url!)
            let f = try JSONDecoder().decode(ForecastResponse.self, from: data)
            let high = f.daily.temperature_2m_max.first ?? f.current.temperature_2m
            let low = f.daily.temperature_2m_min.first ?? f.current.temperature_2m
            let now = Date()
            var list = [SkyEntry(date: now, place: name, tempC: f.current.temperature_2m, code: f.current.weather_code,
                                 isDay: f.current.is_day == 1, windKmh: f.current.wind_speed_10m, highC: high, lowC: low)]
            let h = f.hourly
            let count = min(h.time.count, h.temperature_2m.count, h.weather_code.count, h.is_day.count, h.wind_speed_10m.count)
            for i in 0..<count where list.count < 7 {
                let t = Date(timeIntervalSince1970: h.time[i])
                if t <= now { continue }
                list.append(SkyEntry(date: t, place: name, tempC: h.temperature_2m[i], code: h.weather_code[i],
                                     isDay: h.is_day[i] == 1, windKmh: h.wind_speed_10m[i], highC: high, lowC: low))
            }
            return list
        } catch {
            var entry = SkyEntry.sample
            entry.failed = true
            return [entry]
        }
    }
}

struct SkyProvider: TimelineProvider {
    func placeholder(in context: Context) -> SkyEntry { .sample }

    func getSnapshot(in context: Context, completion: @escaping (SkyEntry) -> Void) {
        if context.isPreview {
            completion(.sample)
            return
        }
        Task { completion(await SkyFetcher.entries().first ?? .sample) }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SkyEntry>) -> Void) {
        Task {
            let entries = await SkyFetcher.entries()
            let failed = entries.first?.failed ?? true
            // Fetch again in an hour (or sooner if it didn't work).
            let next = Date().addingTimeInterval(failed ? 15 * 60 : 60 * 60)
            completion(Timeline(entries: entries, policy: .after(next)))
        }
    }
}

// MARK: - Looks

func skyGradient(_ kind: SkyKind, isDay: Bool) -> [Color] {
    if !isDay {
        switch kind {
        case .clear, .partly: return [Color(red: 0.04, green: 0.06, blue: 0.19), Color(red: 0.16, green: 0.15, blue: 0.38)]
        default: return [Color(red: 0.08, green: 0.09, blue: 0.14), Color(red: 0.2, green: 0.22, blue: 0.3)]
        }
    }
    switch kind {
    case .clear: return [Color(red: 0.18, green: 0.5, blue: 0.86), Color(red: 1.0, green: 0.76, blue: 0.56)]
    case .partly: return [Color(red: 0.24, green: 0.52, blue: 0.86), Color(red: 0.62, green: 0.78, blue: 0.95)]
    case .cloudy, .fog: return [Color(red: 0.42, green: 0.48, blue: 0.57), Color(red: 0.68, green: 0.72, blue: 0.78)]
    case .drizzle, .rain, .heavy: return [Color(red: 0.25, green: 0.33, blue: 0.45), Color(red: 0.45, green: 0.55, blue: 0.66)]
    case .snow: return [Color(red: 0.55, green: 0.65, blue: 0.8), Color(red: 0.88, green: 0.92, blue: 0.97)]
    case .storm: return [Color(red: 0.15, green: 0.16, blue: 0.24), Color(red: 0.36, green: 0.36, blue: 0.48)]
    }
}

struct SkyWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: SkyEntry

    var body: some View {
        content
            .containerBackground(for: .widget) {
                LinearGradient(colors: skyGradient(entry.kind, isDay: entry.isDay), startPoint: .top, endPoint: .bottom)
            }
    }

    @ViewBuilder private var content: some View {
        switch family {
        case .accessoryCircular:
            ZStack {
                AccessoryWidgetBackground()
                VStack(spacing: 0) {
                    Image(entry.puff.image).resizable().scaledToFit().frame(height: 26)
                    Text(entry.temp).font(.system(.headline, design: .rounded))
                        .contentTransition(.numericText())
                }
            }
        case .accessoryRectangular:
            HStack(spacing: 8) {
                Image(entry.puff.image).resizable().scaledToFit().frame(height: 46)
                VStack(alignment: .leading, spacing: 0) {
                    Text("\(entry.temp) \(entry.condition)").font(.headline).lineLimit(1).minimumScaleFactor(0.8)
                    Text(entry.puff.line).font(.caption).lineLimit(2).minimumScaleFactor(0.85)
                }
            }
        case .accessoryInline:
            Text("💧 \(entry.temp) · \(entry.condition)")
        case .systemMedium:
            HStack(spacing: 12) {
                VStack(spacing: 6) {
                    puffView(height: 82)
                    speechBubble(entry.puff.line, font: .system(.caption, design: .rounded).weight(.medium))
                }
                .frame(maxWidth: .infinity)
                VStack(alignment: .leading, spacing: 2) {
                    Text(entry.place).font(.system(.subheadline, design: .rounded).weight(.medium)).lineLimit(1)
                    Text(entry.temp)
                        .font(.system(size: 46, weight: .semibold, design: .rounded))
                        .contentTransition(.numericText())
                    Text("\(SkyText.emoji(code: entry.code, isDay: entry.isDay)) \(entry.condition)")
                        .font(.system(.footnote, design: .rounded)).lineLimit(1).minimumScaleFactor(0.8)
                    Text("H \(SkyText.temp(entry.highC, fahrenheit: entry.fahrenheit))  L \(SkyText.temp(entry.lowC, fahrenheit: entry.fahrenheit))")
                        .font(.system(.caption, design: .rounded)).opacity(0.85)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .foregroundStyle(.white)
            .overlay(alignment: .bottomTrailing) { failedNote }
        default: // systemSmall
            VStack(alignment: .leading, spacing: 3) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 0) {
                        Text(entry.place).font(.system(.caption, design: .rounded).weight(.medium)).lineLimit(1).opacity(0.9)
                        Text(entry.temp)
                            .font(.system(size: 38, weight: .semibold, design: .rounded))
                            .contentTransition(.numericText())
                        Text(entry.condition).font(.system(.caption2, design: .rounded)).lineLimit(1).minimumScaleFactor(0.8)
                    }
                    Spacer(minLength: 0)
                    puffView(height: 62)
                }
                Spacer(minLength: 0)
                speechBubble(entry.puff.line, font: .system(.caption2, design: .rounded).weight(.medium))
            }
            .foregroundStyle(.white)
            .overlay(alignment: .topTrailing) { failedNote }
        }
    }

    /// Puff hops in with a new outfit when the weather changes.
    private func puffView(height: CGFloat) -> some View {
        Image(entry.puff.image)
            .resizable()
            .scaledToFit()
            .frame(height: height)
            .shadow(color: .black.opacity(0.25), radius: 4, y: 2)
            .id(entry.puff.image)
            .transition(.push(from: .bottom))
    }

    /// Puff's message in a little speech bubble; wraps instead of getting cut off.
    private func speechBubble(_ text: String, font: Font) -> some View {
        Text(text)
            .font(font)
            .foregroundStyle(Color(red: 0.11, green: 0.15, blue: 0.25))
            .multilineTextAlignment(.center)
            .lineLimit(2)
            .minimumScaleFactor(0.75)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .frame(maxWidth: .infinity)
            .background(.white.opacity(0.92), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    @ViewBuilder private var failedNote: some View {
        if entry.failed {
            Text("Offline").font(.caption2).padding(4).background(.black.opacity(0.3), in: Capsule())
        }
    }
}

struct SkyMoodWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "SkyMoodWidget", provider: SkyProvider()) { entry in
            SkyWidgetView(entry: entry)
        }
        .configurationDisplayName("Sky Mood")
        .description("Puff, dressed for the weather where you are, with a message.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}
