// The Dynamic Island (and Lock Screen) Live Activity: Puff, dressed for the weather,
// the temperature and a message from Puff.
// The app starts and updates it (see SkyMoodNativePlugin.swift).

import ActivityKit
import WidgetKit
import SwiftUI

/// Puff's picture, fitted into a box of the given height.
struct PuffImage: View {
    let name: String
    let height: CGFloat

    var body: some View {
        Image(name)
            .resizable()
            .scaledToFit()
            .frame(height: height)
            .id(name)
            .transition(.push(from: .bottom))
    }
}

struct SkyLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: SkyMoodAttributes.self) { context in
            SkyLockScreenView(context: context)
                .activityBackgroundTint(Color(red: 0.05, green: 0.08, blue: 0.2).opacity(0.85))
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    PuffImage(name: context.state.puffImage, height: 58)
                        .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    VStack(alignment: .trailing, spacing: 0) {
                        Text(context.state.temp)
                            .font(.system(size: 32, weight: .semibold, design: .rounded))
                            .contentTransition(.numericText())
                        Text("H \(context.state.high) L \(context.state.low)")
                            .font(.system(.caption, design: .rounded))
                            .foregroundStyle(.secondary)
                    }
                    .padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.center) {
                    VStack(spacing: 2) {
                        Text(context.attributes.place)
                            .font(.system(.caption, design: .rounded))
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                        Text("\(context.state.weatherEmoji) \(context.state.condition)")
                            .font(.system(.headline, design: .rounded))
                            .lineLimit(1)
                            .minimumScaleFactor(0.75)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    // Puff's message: full width, room for two lines, kept clear of the rounded edges
                    Text("💬 \(context.state.puffLine)")
                        .font(.system(.subheadline, design: .rounded).weight(.medium))
                        .multilineTextAlignment(.center)
                        .lineLimit(2)
                        .minimumScaleFactor(0.8)
                        .frame(maxWidth: .infinity)
                        .padding(.horizontal, 14)
                        .padding(.top, 4)
                }
            } compactLeading: {
                PuffImage(name: context.state.puffImage, height: 22)
            } compactTrailing: {
                Text(context.state.temp)
                    .font(.system(.body, design: .rounded).weight(.semibold))
                    .contentTransition(.numericText())
            } minimal: {
                PuffImage(name: context.state.puffImage, height: 22)
            }
            .keylineTint(Color(red: 0.55, green: 0.78, blue: 0.95))
        }
    }
}

struct SkyLockScreenView: View {
    let context: ActivityViewContext<SkyMoodAttributes>

    var body: some View {
        HStack(spacing: 14) {
            PuffImage(name: context.state.puffImage, height: 70)
            VStack(alignment: .leading, spacing: 3) {
                Text(context.attributes.place)
                    .font(.system(.caption, design: .rounded))
                    .foregroundStyle(.white.opacity(0.75))
                    .lineLimit(1)
                Text("\(context.state.weatherEmoji) \(context.state.condition)")
                    .font(.system(.headline, design: .rounded))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                Text(context.state.puffLine)
                    .font(.system(.footnote, design: .rounded))
                    .foregroundStyle(.white.opacity(0.9))
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
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
