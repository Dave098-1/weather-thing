// Everything the widget extension offers: the widget and the Dynamic Island Live Activity.

import WidgetKit
import SwiftUI

@main
struct SkyWidgetBundle: WidgetBundle {
    var body: some Widget {
        SkyMoodWidget()
        SkyLiveActivity()
    }
}
