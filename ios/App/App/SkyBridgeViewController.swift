// The app's main screen: Capacitor's web view, plus our own native plugin.

import UIKit
import Capacitor

class SkyBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(SkyMoodNativePlugin())
    }
}
