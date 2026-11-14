// Shared by the app and the widget extension (it's in both targets).
// Weather codes are the WMO codes that Open-Meteo uses, same as the website.

import Foundation
#if canImport(ActivityKit)
import ActivityKit
#endif

/// The App Group used to share the chosen place with the widget.
/// It only works once the "App Groups" capability is turned on for both targets
/// (needs a paid Apple Developer account). Without it the widget uses your
/// current location instead.
let skyAppGroup = "group.io.github.dave0981.skymood"

enum SkyKind: String, Codable {
    case clear, partly, cloudy, fog, drizzle, rain, heavy, snow, storm

    init(code: Int) {
        switch code {
        case 0, 1: self = .clear
        case 2: self = .partly
        case 3: self = .cloudy
        case 45, 48: self = .fog
        case 51...57: self = .drizzle
        case 61, 63, 66, 80: self = .rain
        case 65, 67, 81, 82: self = .heavy
        case 71...77, 85, 86: self = .snow
        case 95...99: self = .storm
        default: self = .cloudy
        }
    }
}

enum SkyText {
    static func label(code: Int) -> String {
        switch code {
        case 0: return "Clear sky"
        case 1: return "Mainly clear"
        case 2: return "Partly cloudy"
        case 3: return "Overcast"
        case 45: return "Fog"
        case 48: return "Freezing fog"
        case 51: return "Light drizzle"
        case 53: return "Drizzle"
        case 55: return "Heavy drizzle"
        case 56, 57: return "Freezing drizzle"
        case 61: return "Light rain"
        case 63: return "Rain"
        case 65: return "Heavy rain"
        case 66, 67: return "Freezing rain"
        case 71: return "Light snow"
        case 73: return "Snow"
        case 75: return "Heavy snow"
        case 77: return "Snow grains"
        case 80: return "Rain showers"
        case 81: return "Heavy showers"
        case 82: return "Violent showers"
        case 85, 86: return "Snow showers"
        case 95: return "Thunderstorm"
        case 96, 99: return "Thunderstorm with hail"
        default: return "Cloudy"
        }
    }

    static func emoji(code: Int, isDay: Bool) -> String {
        switch SkyKind(code: code) {
        case .clear: return isDay ? (code == 1 ? "🌤️" : "☀️") : "🌙"
        case .partly: return isDay ? "⛅" : "☁️"
        case .cloudy: return "☁️"
        case .fog: return "🌫️"
        case .drizzle: return isDay ? "🌦️" : "🌧️"
        case .rain, .heavy: return "🌧️"
        case .snow: return "🌨️"
        case .storm: return "⛈️"
        }
    }

    /// e.g. "18°" in Celsius or Fahrenheit.
    static func temp(_ celsius: Double, fahrenheit: Bool) -> String {
        let v = fahrenheit ? celsius * 9 / 5 + 32 : celsius
        return "\(Int(v.rounded()))°"
    }

    static var prefersFahrenheit: Bool {
        if #available(iOS 16, *) {
            return Locale.current.measurementSystem == .us
        }
        return !Locale.current.usesMetricSystem
    }
}

/// The weather animal: a different animal for every kind of weather.
struct SkyAnimal: Codable, Hashable {
    let emoji: String
    let name: String
    let line: String

    static func forWeather(code: Int, tempC: Double, windKmh: Double, isDay: Bool) -> SkyAnimal {
        switch SkyKind(code: code) {
        case .storm: return SkyAnimal(emoji: "🐢", name: "Turtle", line: "Hiding in its shell")
        case .snow: return SkyAnimal(emoji: "🐧", name: "Penguin", line: "Feels right at home")
        case .heavy: return SkyAnimal(emoji: "🐸", name: "Frog", line: "Throwing a pond party")
        case .rain, .drizzle: return SkyAnimal(emoji: "🦆", name: "Duck", line: "Splashing in puddles")
        case .fog: return SkyAnimal(emoji: "🦔", name: "Hedgehog", line: "Lost in the fog")
        default: break
        }
        if windKmh >= 40 { return SkyAnimal(emoji: "🦅", name: "Eagle", line: "Gliding on the wind") }
        if tempC <= -5 { return SkyAnimal(emoji: "🐻‍❄️", name: "Polar bear", line: "Loving the cold") }
        if !isDay { return SkyAnimal(emoji: "🦉", name: "Owl", line: "Wide awake tonight") }
        if tempC >= 28 { return SkyAnimal(emoji: "🐪", name: "Camel", line: "Perfect camel weather") }
        switch SkyKind(code: code) {
        case .clear: return SkyAnimal(emoji: "🦎", name: "Lizard", line: "Sunbathing on a rock")
        case .partly: return SkyAnimal(emoji: "🐝", name: "Bee", line: "Busy between the clouds")
        default: return SkyAnimal(emoji: "🐑", name: "Sheep", line: "Blending in with the clouds")
        }
    }
}

#if canImport(ActivityKit)
/// The Live Activity shown in the Dynamic Island and on the Lock Screen.
@available(iOS 16.1, *)
struct SkyMoodAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var temp: String
        var condition: String
        var weatherEmoji: String
        var animalEmoji: String
        var animalName: String
        var animalLine: String
        var high: String
        var low: String
        var isDay: Bool
        var kind: String
    }

    var place: String
}
#endif
