// Lets the web code (src/native.js) control the Dynamic Island Live Activity
// and refresh the widgets.

import Foundation
import Capacitor
import WidgetKit
#if canImport(ActivityKit)
import ActivityKit
#endif

@objc(SkyMoodNativePlugin)
public class SkyMoodNativePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SkyMoodNativePlugin"
    public let jsName = "SkyMoodNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "islandStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showIsland", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateIsland", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hideIsland", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateWidgets", returnType: CAPPluginReturnPromise),
    ]

    /// { supported, enabled, active }
    @objc func islandStatus(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        if #available(iOS 16.2, *) {
            call.resolve([
                "supported": true,
                "enabled": ActivityAuthorizationInfo().areActivitiesEnabled,
                "active": !Activity<SkyMoodAttributes>.activities.isEmpty,
            ])
            return
        }
        #endif
        call.resolve(["supported": false, "enabled": false, "active": false])
    }

    /// Start (or refresh) the Live Activity with the current weather.
    @objc func showIsland(_ call: CAPPluginCall) {
        startOrUpdate(call, startIfMissing: true)
    }

    /// Refresh it only if it's already showing.
    @objc func updateIsland(_ call: CAPPluginCall) {
        startOrUpdate(call, startIfMissing: false)
    }

    @objc func hideIsland(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        if #available(iOS 16.2, *) {
            Task {
                for activity in Activity<SkyMoodAttributes>.activities {
                    await activity.end(nil, dismissalPolicy: .immediate)
                }
                call.resolve(["active": false])
            }
            return
        }
        #endif
        call.resolve(["active": false])
    }

    /// Save the chosen place for the widget (works when App Groups are turned on) and refresh widgets.
    @objc func updateWidgets(_ call: CAPPluginCall) {
        if let shared = UserDefaults(suiteName: skyAppGroup),
           let lat = call.getDouble("lat"), let lon = call.getDouble("lon") {
            shared.set(lat, forKey: "lat")
            shared.set(lon, forKey: "lon")
            shared.set(call.getString("place") ?? "My sky", forKey: "place")
        }
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }

    private func startOrUpdate(_ call: CAPPluginCall, startIfMissing: Bool) {
        #if canImport(ActivityKit)
        guard #available(iOS 16.2, *) else {
            call.reject("The Dynamic Island needs iOS 16.2 or newer.")
            return
        }
        let place = call.getString("place") ?? "Sky Mood"
        let code = call.getInt("code") ?? 3
        let tempC = call.getDouble("tempC") ?? 0
        let isDay = call.getBool("isDay") ?? true
        let wind = call.getDouble("wind") ?? 0
        let highC = call.getDouble("highC") ?? tempC
        let lowC = call.getDouble("lowC") ?? tempC
        let fahrenheit = call.getBool("fahrenheit") ?? SkyText.prefersFahrenheit

        let animal = SkyAnimal.forWeather(code: code, tempC: tempC, windKmh: wind, isDay: isDay)
        let state = SkyMoodAttributes.ContentState(
            temp: SkyText.temp(tempC, fahrenheit: fahrenheit),
            condition: SkyText.label(code: code),
            weatherEmoji: SkyText.emoji(code: code, isDay: isDay),
            animalEmoji: animal.emoji,
            animalName: animal.name,
            animalLine: animal.line,
            high: SkyText.temp(highC, fahrenheit: fahrenheit),
            low: SkyText.temp(lowC, fahrenheit: fahrenheit),
            isDay: isDay,
            kind: SkyKind(code: code).rawValue
        )
        // After two hours without an update iOS shows it as out of date.
        let content = ActivityContent(state: state, staleDate: Date().addingTimeInterval(2 * 60 * 60))

        Task {
            let existing = Activity<SkyMoodAttributes>.activities
            if let current = existing.first, current.attributes.place == place {
                await current.update(content)
                for extra in existing.dropFirst() {
                    await extra.end(nil, dismissalPolicy: .immediate)
                }
                call.resolve(["active": true, "animal": animal.emoji])
                return
            }
            if existing.isEmpty && !startIfMissing {
                call.resolve(["active": false])
                return
            }
            // New place (or nothing showing yet): replace it.
            for activity in existing {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
            guard ActivityAuthorizationInfo().areActivitiesEnabled else {
                call.reject("Live Activities are turned off for Sky Mood. Turn them on in Settings › Sky Mood.")
                return
            }
            do {
                _ = try Activity<SkyMoodAttributes>.request(attributes: SkyMoodAttributes(place: place), content: content, pushType: nil)
                call.resolve(["active": true, "animal": animal.emoji])
            } catch {
                call.reject("Couldn't show it in the Dynamic Island: \(error.localizedDescription)")
            }
        }
        #else
        call.reject("The Dynamic Island isn't available here.")
        #endif
    }
}
