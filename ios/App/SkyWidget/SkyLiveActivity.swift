// The Dynamic Island (and Lock Screen) Live Activity: your weather animal and the temperature.
// The app starts and updates it (see SkyMoodNativePlugin.swift).

import ActivityKit
import WidgetKit
import SwiftUI

struct SkyLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: SkyMoodAttributes.self) { context in
            SkyLockScreenView(context: context)
                .activityBackgroundTint(Color(red: 0.05, green: 0.08, blue: 0.2).opacity(0.85))
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text(context.state.animalEmoji)
                        .font(.system(size: 44))
                        .id(context.state.animalEmoji)
                        .transition(.push(from: .bottom))
                }
                DynamicIslandExpandedRegion(.trailing) {
                    VStack(alignment: .trailing, spacing: 0) {
                        Text(context.state.temp)
                            .font(.system(size: 32, weight: .semibold, design: .rounded))
                            .contentTransition(.numericText())
                        Text(context.state.weatherEmoji).font(.title3)
                    }
                }
                DynamicIslandExpandedRegion(.center) {
                    VStack(spacing: 2) {
                        Text(context.attributes.place)
                            .font(.system(.caption, design: .rounded))
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                        Text(context.state.condition)
                            .font(.system(.headline, design: .rounded))
                            .lineLimit(1)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        Text("\(context.state.animalName): \(context.state.animalLine)")
                            .lineLimit(1)
                        Spacer()
                        Text("H \(context.state.high)  L \(context.state.low)")
                            .foregroundStyle(.secondary)
                    }
                    .font(.system(.footnote, design: .rounded))
                }
            } compactLeading: {
                Text(context.state.animalEmoji)
                    .id(context.state.animalEmoji)
                    .transition(.push(from: .bottom))
            } compactTrailing: {
                Text(context.state.temp)
                    .font(.system(.body, design: .rounded).weight(.semibold))
                    .contentTransition(.numericText())
            } minimal: {
                Text(context.state.animalEmoji)
            }
            .keylineTint(Color(red: 1.0, green: 0.83, blue: 0.42))
        }
    }
}

struct SkyLockScreenView: View {
    let context: ActivityViewContext<SkyMoodAttributes>

    var body: some View {
        HStack(spacing: 14) {
            Text(context.state.animalEmoji)
                .font(.system(size: 48))
                .id(context.state.animalEmoji)
                .transition(.push(from: .bottom))
            VStack(alignment: .leading, spacing: 2) {
                Text(context.attributes.place)
                    .font(.system(.caption, design: .rounded))
                    .foregroundStyle(.white.opacity(0.75))
                    .lineLimit(1)
                Text("\(context.state.weatherEmoji) \(context.state.condition)")
                    .font(.system(.headline, design: .rounded))
                    .lineLimit(1)
                Text("\(context.state.animalName): \(context.state.animalLine)")
                    .font(.system(.footnote, design: .rounded))
                    .foregroundStyle(.white.opacity(0.85))
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
            VStack(alignment: .trailing, spacing: 0) {
                Text(context.state.temp)
                    .font(.system(size: 38, weight: .semibold, design: .rounded))
                    .contentTransition(.numericText())
                Text("H \(context.state.high) L \(context.state.low)")
                    .font(.system(.caption, design: .rounded))
                    .foregroundStyle(.white.opacity(0.75))
            }
        }
        .foregroundStyle(.white)
        .padding(16)
    }
}
